import os, sys, time, threading, random
import Pyro5.api, logging

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
        self.votes = 0
        self.started_election = None
        self.peers_alive = set()

        # Tracker & heartbeat
        self.is_tracker = False
        self.current_tracker = None
        self.hb_timer = None

        logging.info(f"Peer {self.id} init. Local files: {self.files}")

    # ----------------------------------------------------------------
    # 1) Registro no NameServer e descoberta de Tracker
    # ----------------------------------------------------------------
    def connect(self):
        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        uri = daemon.register(self)
        ns.register(f"peer.{self.id}", uri)
        logging.info(f"Peer.{self.id} registrado → {uri}")

        # busca maior Tracker_Epoca_X
        best = 0
        for name, u in ns.list().items():
            if name.startswith("Tracker_Epoca_"):
                x = int(name.rsplit("_",1)[1])
                if x>best:
                    best, self.current_tracker = x, u
        if self.current_tracker:
            print(f"Current Tracker: ", self.current_tracker)
            self._tell_tracker_my_files()
            self._reset_hb_timer()

        else:
            # se não tem tracker nenhum, já inicia eleição
            time.sleep(10)
            print("No tracker found!")
            self._start_election()


    def _reset_hb_timer(self):
        # cancela qualquer timer antigo
        if self.hb_timer:
            self.hb_timer.cancel()
        # agenda novo timer para disparar _start_election
        delay = random.uniform(0.15, 0.3)
        self.hb_timer = threading.Timer(delay, self._start_election)
        self.hb_timer.daemon = True
        self.hb_timer.start()

    # ----------------------------------------------------------------
    # 2) Registro inicial de arquivos no tracker
    # ----------------------------------------------------------------
    @Pyro5.api.expose
    def register_all_files(self, peer_id, files):
        if self.is_tracker:
            for f in files:
                self.index.setdefault(f,set()).add(peer_id)
            return True

    def _tell_tracker_my_files(self):
        try:
            tracker = Pyro5.api.Proxy(self.current_tracker)
            tracker.register_all_files(self.id, list(self.files))
            logging.info("Arquivos iniciais registrados no tracker")
        except:
            pass

    # ----------------------------------------------------------------
    # 3) Eleição simples por Época+Maioria
    # ----------------------------------------------------------------
    def _start_election(self):
        # **2) limpa estado de eleição antigo**
        self.started_election = None
        self.voted_for = None
        self.votes = set()

        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        # pega apenas os peers cadastrados
        peers = {name: uri for name, uri in ns.list().items() if name.startswith("peer.")}

        responded = set()
        for name, uri in peers.items():
            peer_num = int(name.split(".")[1])
            if peer_num == self.id:
                continue
            try:
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5
                proxy.signal_alive(self.id)      # tenta saber se ele está vivo
                responded.add(peer_num)          # só aqui confirmo que respondeu
            except Exception as e:
                print(f"Não conseguiu sinalizar alive para {name}: {e}")
                pass

        # agora sim guardo só quem respondeu
        self.peers_alive = responded
        total_participants = len(responded) + 1  # +1 é você mesmo
        majority = total_participants // 2 + 1

        # se ainda não comecei eleição, marco época e voto em mim
        if self.started_election is None:
            self.epoch += 1
            self.started_election = self.id
            self.votes = {self.id}

        # peço voto só a quem respondeu
        for peer_num in responded:
            try:
                uri = peers[f"peer.{peer_num}"]
                proxy = Pyro5.api.Proxy(uri)
                proxy._pyroTimeout = 0.5
                ok = proxy.start_election(self.id, self.epoch)
                if ok:
                    self.votes.add(peer_num)
            except Exception:
                print(f"Não votou {name}: {e}")
                pass

        # checa maioria dinamicamente
        if len(self.votes) >= majority:
            self._become_tracker()



    @Pyro5.api.expose
    def signal_alive(self, peer_id):
        self.peers_alive.add(peer_id)
        return True

    @Pyro5.api.expose
    def start_election(self, cand, ep):
        if ep>self.epoch and self.voted_for is None:
            self.epoch, self.voted_for = ep, cand
            return True
        return False

    @Pyro5.api.expose
    def receive_vote(self, voter, ep):
        if ep==self.epoch:
            self.votes.add(voter)
            return True
        return False

    def _become_tracker(self):
        self.is_tracker = True
        self.current_tracker = None
        self.voted_for = None
        self.started_election = None

        self.index = {}
        tracking_name = f"Tracker_Epoca_{self.epoch}"
        ns = Pyro5.api.locate_ns(host="localhost", port=9090)
        ns.register(tracking_name, daemon.uriFor(self))  # registra novo tracker
        print(f"Eleito tracker da época {self.epoch}: Peer {self.id} → {tracking_name}")
        self._start_heartbeat()  # dispara os heartbeats


    # ----------------------------------------------------------------
    # 4) Heartbeat do Tracker + Timeout nos Peers
    # ----------------------------------------------------------------
    def _start_heartbeat(self):
        def hb_loop():
            ns = Pyro5.api.locate_ns(host="localhost", port=9090)
            while self.is_tracker:
                for name,uri in ns.list().items():
                    if name.startswith("peer.") and name!=f"peer.{self.id}":
                        try:
                            p=Pyro5.api.Proxy(uri); p.receive_heartbeat(self.id,self.epoch)
                        except:
                            print(f"Peer {name} não recebeu heartbeat")
                            pass
                time.sleep(0.1)
        threading.Thread(target=hb_loop,daemon=True).start()

    @Pyro5.api.expose
    def receive_heartbeat(self, tracker_id, ep):
        if ep >= self.epoch:
            # atualiza época e cancela/reinicia o timer
            self.epoch = ep
            self._reset_hb_timer()
        return True

    # ----------------------------------------------------------------
    # 5) File-sharing: index, search, download
    # ----------------------------------------------------------------
    @Pyro5.api.expose
    def update_file_index(self, peer_id, filename, is_add):
        if self.is_tracker:
            if is_add: self.index.setdefault(filename,set()).add(peer_id)
            else:   self.index.get(filename,set()).discard(peer_id)
            return True

    @Pyro5.api.expose
    def search_file(self, filename):
        if self.is_tracker:
            return list(self.index.get(filename,[]))

    @Pyro5.api.expose
    def download_file(self, filename):
        if filename in self.files:
            return open(os.path.join(self.dir,filename),"rb").read()

    # ----------------------------------------------------------------
    # 6) Comandos usuário
    # ----------------------------------------------------------------
    def cli(self):
        while True:
            cmd = input(f"Peer-{self.id}> ").split()
            if not cmd: continue
            op = cmd[0]
            if op=="list":
                print(self.files)
            elif op=="search" and len(cmd)>1:
                peers = (self.search_file(cmd[1]) if self.is_tracker
                         else Pyro5.api.Proxy(self.current_tracker).search_file(cmd[1]))
                print("Árvore:",peers)
            elif op=="download" and len(cmd)>1:
                src = random.choice(peers)
                uri = Pyro5.api.locate_ns().lookup(f"peer.{src}")
                data = Pyro5.api.Proxy(uri).download_file(cmd[1])
                if data:
                    open(os.path.join(self.dir,cmd[1]),"wb").write(data)
                    self.files.add(cmd[1])
                    print("Baixado com sucesso")
            elif op in ("exit","quit"):
                break
            else:
                print("comandos: list, search <f>, download <f>, exit")

if __name__=="__main__":
    if len(sys.argv)!=2:
        print("Uso: python peer.py <id>"); sys.exit(1)
    peer = Peer(int(sys.argv[1]))
    daemon = Pyro5.api.Daemon(host="localhost", port=0)
    threading.Thread(target=daemon.requestLoop, daemon=True).start()
    time.sleep(1)
    peer.connect()
    peer.cli()
