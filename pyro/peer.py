import os, sys, time, threading, random
import Pyro5.api, logging
from Pyro5.serializers import serpent
import base64, pickle, os


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")


class Peer:
    def __init__(self, peer_id):
        self.id = peer_id
        self.dir = f"peers/peer_{peer_id}"
        os.makedirs(self.dir, exist_ok=True)
        self.files = set(os.listdir(self.dir))

        # Estado eleição
        self.epoch = 0
        self.voted_for = None
        self.votes = set()
        self.started_election = None
        self.peers_alive = set()

        # Tracker & heartbeat
        self.is_tracker = False
        self.current_tracker = None
        self.hb_timer = None

        # Variáveis para o detecção de falhas
        self.tracker_failure_detected = False
        self.election_in_progress = False

        # Contagem de peers na rede
        self.expected_peers = 5  # Total esperado de peers

        print(f"Peer {self.id} init. Local files: {self.files}")


    # 1) Registro no NameServer e descoberta de Tracker
    def connect(self):
        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        uri = daemon.register(self)
        ns.register(f"peer.{self.id}", uri)
        logging.info(f"Peer.{self.id} registrado → {uri}")

        # Aguarda um pouco antes de verificar o tracker
        time.sleep(7)

        # Busca maior Tracker_Epoca_X
        best = 0
        best_tracker = None
        for name, u in ns.list().items():
            if name.startswith("Tracker_Epoca_"):
                x = int(name.rsplit("_",1)[1])
                if x > best:
                    best, best_tracker = x, u

        if best_tracker:
            # Se existe tracker, atualiza a época e  registra
            self.epoch = best
            self.current_tracker = best_tracker
            print(f"Current Tracker: {self.current_tracker}, Epoch: {self.epoch}")
            self._tell_tracker_my_files()
            self._reset_hb_timer()
        else:
            # Se não tem tracker, inicia eleição
            logging.info("No tracker found, starting election")
            # Não precisa de sleep adicional aqui, pois já aguardamos 10s acima
            self._start_election()

    def _reset_hb_timer(self):
        """Reinicia o timer de detecção de falha do tracker"""
        # Cancela qualquer timer antigo
        if self.hb_timer:
            self.hb_timer.cancel()

        # Agenda novo timer para detecção de falha do tracker
        delay = random.uniform(0.5, 1)
        self.hb_timer = threading.Timer(delay, self._handle_tracker_failure)
        self.hb_timer.daemon = True
        self.hb_timer.start()
        logging.debug(f"Peer {self.id}: Timer de heartbeat reiniciado para {delay:.2f}s")

    def _handle_tracker_failure(self):
        """Chamado quando o timer expira indicando falha no tracker"""
        if self.is_tracker:
            return  # Se eu sou o tracker, não faço nada

        # Tenta contatar o tracker diretamente para confirmar falha
        try:
            if self.current_tracker:
                tracker = Pyro5.api.Proxy(self.current_tracker)
                tracker._pyroTimeout = 0.2
                alive = tracker.ping()  # Método simples para testar conexão
                if alive:
                    self._reset_hb_timer()
                    return
        except Exception as e:
            logging.info(f"Peer {self.id}: Confirmado! Tracker não responde: {e}")

        # Se chegou aqui, o tracker realmente falhou
        logging.info(f"Peer {self.id}: Iniciando eleição por falha do tracker na época {self.epoch}")
        self.current_tracker = None  # Limpa referência do tracker antigo
        self._start_election()

    # 2) Registro inicial de arquivos no tracker
    @Pyro5.api.expose
    def register_all_files(self, peer_id, files):
        if self.is_tracker:
            for f in files:
                self.index.setdefault(f,set()).add(peer_id)
            return True
        return False

    def _tell_tracker_my_files(self):
        """Registra arquivos locais no tracker"""
        if not self.current_tracker:
            return

        try:
            tracker = Pyro5.api.Proxy(self.current_tracker)
            tracker._pyroTimeout = 0.5
            success = tracker.register_all_files(self.id, list(self.files))
            if success:
                logging.info(f"Peer {self.id}: Arquivos registrados no tracker")
            else:
                logging.warning(f"Peer {self.id}: Falha ao registrar arquivos no tracker")
        except Exception as e:
            logging.error(f"Peer {self.id}: Erro ao registrar arquivos no tracker: {e}")
            # Se falhar ao contatar tracker, pode iniciar detecção de falha
            self._handle_tracker_failure()

    # ----------------------------------------------------------------
    # 3) Eleição simples por Época+Maioria
    # ----------------------------------------------------------------
    def _start_election(self):
        """Inicia uma eleição para novo tracker"""
        if self.election_in_progress:
            logging.info(f"Peer {self.id}: Eleição já em andamento, ignorando")
            return

        self.election_in_progress = True

        # Incrementa a época
        self.epoch += 1
        new_epoch = self.epoch

        # Reinicia estados da eleição
        self.voted_for = self.id  # Vota em si mesmo
        self.votes = {self.id}    # Registra próprio voto

        logging.info(f"Peer {self.id}: Iniciando eleição para época {new_epoch}")

        # Descobre peers ativos
        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        peers = {name: uri for name, uri in ns.list().items() if name.startswith("peer.")}

        # Verifica quais peers estão vivos
        self.peers_alive = set()
        for name, uri in peers.items():
            peer_num = int(name.split(".")[1])
            if peer_num == self.id:
                continue

            try:
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5
                if proxy.ping():  # Método simples de ping
                    self.peers_alive.add(peer_num)
            except Exception as e:
                logging.info(f"Peer {self.id}: Peer {peer_num} não respondeu ao ping")

        # Calcula maioria (incluindo a si mesmo)
        total_participants = len(self.peers_alive) + 1
        majority = total_participants // 2 + 1

        logging.info(f"Peer {self.id}: Peers vivos: {self.peers_alive}, total: {total_participants}, maioria: {majority}")

        # Solicita votos
        for peer_num in self.peers_alive:
            try:
                uri = peers[f"peer.{peer_num}"]
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5

                # Pede voto para epoch atual
                if proxy.request_vote(self.id, new_epoch):
                    self.votes.add(peer_num)
                    logging.info(f"Peer {self.id}: Recebeu voto do peer {peer_num}")
            except Exception as e:
                logging.error(f"Peer {self.id}: Erro ao solicitar voto do peer {peer_num}: {e}")

        # Verifica se obteve maioria
        if len(self.votes) >= majority:
            logging.info(f"Peer {self.id}: Eleito com {len(self.votes)} votos, maioria: {majority}")
            self._become_tracker()
        else:
            logging.info(f"Peer {self.id}: Não eleito, obteve apenas {len(self.votes)} votos, necessário: {majority}")
            # Finaliza estado da eleição
            self.election_in_progress = False

    @Pyro5.api.expose
    def ping(self):
        """Método simples para testar se o peer está vivo"""
        return True

    @Pyro5.api.expose
    def request_vote(self, candidate_id, epoch):
        """Solicita voto para eleição"""
        logging.info(f"Peer {self.id}: Recebeu solicitação de voto de {candidate_id} para época {epoch}, minha época: {self.epoch}")

        if epoch > self.epoch:
            # Epoch maior, atualiza e vota
            self.epoch = epoch
            self.voted_for = candidate_id
            return True
        elif epoch == self.epoch and self.voted_for is None:
            # Mesma época mas não votou ainda
            self.voted_for = candidate_id
            return True

        return False

    def _become_tracker(self):
        """Assume papel de tracker após ser eleito"""
        self.is_tracker = True
        self.voted_for = None
        self.election_in_progress = False

        # Inicializa o índice
        self.index = {}
        tracking_name = f"Tracker_Epoca_{self.epoch}"

        # Registra no NameServer
        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        my_uri = daemon.uriFor(self)
        ns.register(tracking_name, my_uri)

        # Atualiza sua própria referência ao tracker
        self.current_tracker = my_uri

        logging.info(f"ELEITO TRACKER DA ÉPOCA {self.epoch}: Peer {self.id} → {tracking_name}")

        # Notifica todos os peers sobre o novo tracker
        self._notify_all_peers_about_new_tracker()

        # Inicializa o índice coletando arquivos de todos os peers
        self._collect_all_files()

        # Cancela timer de detecção
        if self.hb_timer:
            self.hb_timer.cancel()
            self.hb_timer = None

        # Inicia envio de heartbeats
        self._start_heartbeat()

    def _notify_all_peers_about_new_tracker(self):
        """Notifica todos os peers sobre o novo tracker"""
        if not self.is_tracker:
            return

        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        peers = {name: uri for name, uri in ns.list().items() if name.startswith("peer.")}

        for name, uri in peers.items():
            if name == f"peer.{self.id}":
                continue  # Não notifica a si mesmo

            peer_id = int(name.split(".")[1])
            try:
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5
                success = proxy.update_tracker_reference(self.current_tracker, self.epoch)
                if success:
                    logging.info(f"Tracker {self.id}: Peer {peer_id} atualizado com sucesso")
                else:
                    logging.warning(f"Tracker {self.id}: Peer {peer_id} rejeitou atualização")
            except Exception as e:
                logging.error(f"Tracker {self.id}: Erro ao notificar peer {peer_id}: {e}")

    @Pyro5.api.expose
    def update_tracker_reference(self, tracker_uri, new_epoch):
        """Atualiza a referência do tracker em um nó"""
        logging.info(f"Peer {self.id}: Solicitação para atualizar tracker para época {new_epoch} (atual: {self.epoch})")

        if new_epoch >= self.epoch:
            old_epoch = self.epoch
            self.epoch = new_epoch
            self.current_tracker = tracker_uri
            self.voted_for = None

            # Reinicia o timer de heartbeat
            self._reset_hb_timer()

            logging.info(f"Peer {self.id}: Atualizou referência de tracker, de época {old_epoch} para {new_epoch}")
            return True
        else:
            logging.warning(f"Peer {self.id}: Rejeitou atualização para tracker com época anterior ({new_epoch} < {self.epoch})")
            return False



    def _collect_all_files(self):
        """Coleta arquivos de todos os peers"""
        if not self.is_tracker:
            return

        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        peers = {name: uri for name, uri in ns.list().items() if name.startswith("peer.")}

        # Adiciona os próprios arquivos
        for f in self.files:
            self.index.setdefault(f, set()).add(self.id)

        # Coleta arquivos dos outros peers
        for name, uri in peers.items():
            if name == f"peer.{self.id}":
                continue

            peer_id = int(name.split(".")[1])
            try:
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5
                files = proxy.get_file_list()
                for f in files:
                    self.index.setdefault(f, set()).add(peer_id)
            except Exception as e:
                logging.error(f"Erro ao coletar arquivos do peer {peer_id}: {e}")

    @Pyro5.api.expose
    def get_file_list(self):
        """Retorna lista de arquivos locais"""
        return list(self.files)

    # 4) Heartbeat do Tracker + Timeout nos Peers
    def _start_heartbeat(self):
        """Inicia envio periódico de heartbeats aos peers"""
        def hb_loop():
            while self.is_tracker:
                try:
                    ns = Pyro5.api.locate_ns(host="localhost", port=9090)
                    peers = {name: uri for name, uri in ns.list().items() if name.startswith("peer.")}

                    for name, uri in peers.items():
                        if name == f"peer.{self.id}":
                            continue  # Não envia heartbeat para si mesmo

                        try:
                            peer_proxy = Pyro5.api.Proxy(uri)
                            peer_proxy._pyroTimeout = 0.2
                            peer_proxy.receive_heartbeat(self.id, self.epoch)
                        except Exception as e:
                            pass

                    # Heartbeat a cada 100ms conforme especificação
                    time.sleep(0.1)
                except Exception as e:
                    logging.error(f"Erro no loop de heartbeat: {e}")

        hb_thread = threading.Thread(target=hb_loop, daemon=True)
        hb_thread.start()
        logging.info(f"Tracker {self.id}: Iniciou envio de heartbeats")

    @Pyro5.api.expose
    def receive_heartbeat(self, tracker_id, epoch):
        """Recebe heartbeat do tracker atual"""
        if self.is_tracker:
            # Se sou tracker, ignoro heartbeats de outros
            return False

        if epoch >= self.epoch:
            # Atualiza época se necessário
            if epoch > self.epoch:
                logging.info(f"Peer {self.id}: Atualizando época de {self.epoch} para {epoch}")
                self.epoch = epoch
                self.voted_for = None  # Reseta voto para nova época

            # Reinicia timer de detecção
            self._reset_hb_timer()

            # Limpa flags de falha/eleição
            self.tracker_failure_detected = False
            self.election_in_progress = False

            return True
        else:
            return False

    # 5) File-sharing: index, search, download
    @Pyro5.api.expose
    def update_file_index(self, peer_id, filename, is_add):
        """Atualiza o índice de arquivos (adição/remoção)"""
        if self.is_tracker:
            if is_add:
                self.index.setdefault(filename, set()).add(peer_id)
                logging.info(f"Tracker {self.id}: Adicionado arquivo {filename} do peer {peer_id}")
            else:
                if filename in self.index:
                    self.index[filename].discard(peer_id)
                    logging.info(f"Tracker {self.id}: Removido arquivo {filename} do peer {peer_id}")
            return True
        return False

    @Pyro5.api.expose
    def search_file(self, filename):
        """Busca por um arquivo no índice"""
        if self.is_tracker:
            peers = list(self.index.get(filename, []))
            logging.info(f"Tracker {self.id}: Busca por '{filename}' retornou peers {peers}")
            return peers
        return []

    @Pyro5.api.expose
    def download_file(self, filename):
        """Fornece arquivo para download por outro peer"""
        if filename in self.files:
            try:
                filepath = os.path.join(self.dir, filename)
                with open(filepath, "rb") as f:
                    data = f.read()
                logging.info(f"Peer {self.id}: Enviando arquivo {filename}")
                return data
            except Exception as e:
                logging.error(f"Erro ao ler arquivo {filename}: {e}")
        return None

    # 6) Comandos usuário
    def cli(self):
        print(f"\nPeer {self.id} iniciado. Digite 'help' para ver os comandos disponíveis.\n")

        while True:
            cmd = input(f"Peer-{self.id}> ").split()
            if not cmd:
                continue

            op = cmd[0].lower()

            if op == "list":
                print(f"Arquivos locais: {self.files}")

            elif op == "search" and len(cmd) > 1:
                filename = cmd[1]
                try:
                    if self.is_tracker:
                        peers = self.search_file(filename)
                    else:
                        if not self.current_tracker:
                            print("Tracker não disponível")
                            continue

                        tracker = Pyro5.api.Proxy(self.current_tracker)
                        tracker._pyroTimeout = 0.5
                        peers = tracker.search_file(filename)

                    if peers:
                        print(f"Arquivo '{filename}' disponível nos peers: {peers}")
                    else:
                        print(f"Arquivo '{filename}' não encontrado na rede")
                except Exception as e:
                    print(f"Erro na busca: {e}")

            elif op == "download" and len(cmd) > 1:
                filename = cmd[1]
                try:
                    # Busca o arquivo
                    if self.is_tracker:
                        peers = self.search_file(filename)
                    else:
                        if not self.current_tracker:
                            print("Tracker não disponível")
                            continue

                        tracker = Pyro5.api.Proxy(self.current_tracker)
                        tracker._pyroTimeout = 0.5
                        peers = tracker.search_file(filename)

                    if not peers:
                        print(f"Arquivo '{filename}' não encontrado na rede")
                        continue

                    # Filtra para não baixar de si mesmo
                    available_peers = [p for p in peers if p != self.id]
                    if not available_peers:
                        print(f"Você já possui o arquivo '{filename}'")
                        continue

                    # Escolhe um peer aleatório
                    src = random.choice(available_peers)
                    print(f"Baixando '{filename}' do peer {src}...")

                    # Baixa o arquivo
                    ns = Pyro5.api.locate_ns()
                    uri = ns.lookup(f"peer.{src}")
                    peer_proxy = Pyro5.api.Proxy(uri)
                    peer_proxy._pyroTimeout = 5.0  # Timeout maior para download
                    data = peer_proxy.download_file(filename)

                    if data:
                        try:
                            if not isinstance(data, bytes):
                                if hasattr(serpent, 'tobytes') and hasattr(data, 'data'):
                                    data = serpent.tobytes(data.data)
                                elif isinstance(data, dict) and 'data' in data:
                                    # Tenta extrair os bytes do dicionário retornado pelo Pyro
                                    import base64
                                    data = base64.b64decode(data['data'])
                                else:
                                    print(f"Aviso: Formato de dados inesperado: {type(data)}")
                                    # Se tudo falhar, tenta serializar e converter para bytes
                                    import pickle
                                    data = pickle.dumps(data)

                                # Salva localmente
                                with open(os.path.join(self.dir, filename), "wb") as f:
                                    f.write(data)
                                self.files.add(filename)

                        except Exception as e:
                            print(f"Erro ao processar dados: {e}")
                            import traceback
                            traceback.print_exc()

                            continue


                        # Notifica o tracker
                        if not self.is_tracker:
                            tracker = Pyro5.api.Proxy(self.current_tracker)
                            tracker.update_file_index(self.id, filename, True)
                        else:
                            self.update_file_index(self.id, filename, True)

                        print(f"Arquivo '{filename}' baixado com sucesso")
                    else:
                        print(f"Falha ao baixar arquivo '{filename}'")

                except Exception as e:
                    print(f"Erro no download: {e}")

            elif op == "status":
                print(f"\n--- STATUS DO PEER {self.id} ---")
                print(f"Época atual: {self.epoch}")
                print(f"É tracker: {self.is_tracker}")
                print(f"Tracker atual: {self.current_tracker}")
                print(f"Arquivos locais: {self.files}")
                # print(f"Peers vivos conhecidos: {self.peers_alive}")
                if self.is_tracker:
                    print(f"Índice de arquivos: {self.index}")
                print("")

            elif op == "help":
                print("\nComandos disponíveis:")
                print("  list             - listar arquivos locais")
                print("  search <arquivo> - buscar arquivo na rede")
                print("  download <arq>   - baixar arquivo")
                print("  status           - mostrar informações do peer")
                print("  help             - mostrar esta ajuda")
                print("  exit/quit        - sair\n")

            elif op in ("exit", "quit"):
                break

            else:
                print("Comando desconhecido. Digite 'help' para ver os comandos disponíveis.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python peer.py <id>")
        sys.exit(1)

    peer = Peer(int(sys.argv[1]))
    daemon = Pyro5.api.Daemon(host="localhost", port=0)
    threading.Thread(target=daemon.requestLoop, daemon=True).start()
    time.sleep(1)
    peer.connect()
    peer.cli()
