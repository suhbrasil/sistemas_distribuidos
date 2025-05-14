import Pyro5.api
import threading
import time
import sys

@Pyro5.api.expose
class StringService:
    def __init__(self, name):
        self.name = name

    def reverse(self, text: str) -> str:
        """Retorna o texto invertido."""
        return text[::-1]

    def count(self, text: str) -> int:
        """Retorna o número de caracteres do texto."""
        return len(text)


def main():
    # 1. Criar a classe (definição única acima)

    # 2. Instância do Daemon
    daemon = Pyro5.api.Daemon(host="localhost", port=0)

    # 3. Registrar duas instâncias do mesmo objeto no Daemon
    uri1 = daemon.register(StringService("instance1"))
    uri2 = daemon.register(StringService("instance2"))
    print(f"[Daemon] URI de instance1 = {uri1}")
    print(f"[Daemon] URI de instance2 = {uri2}")

    # 4. Localizar o serviço de nomes (NameServer)
    try:
        ns = Pyro5.api.locate_ns()
        print("[NameServer] encontrado em localhost:9090")
    except Exception as e:
        print(f"[ERROR] NameServer não encontrado: {e}")
        sys.exit(1)

    # 5. Registrar cada URI no NameServer
    ns.register("example.service1", uri1)
    ns.register("example.service2", uri2)
    print("[NameServer] URIs registradas com sucesso")

    # 7. Iniciar requestLoop() em background para não bloquear o fluxo principal
    threading.Thread(target=daemon.requestLoop, daemon=True).start()
    print("[Daemon] requestLoop() rodando em background")

    # Permitir um breve atraso para o Daemon subir
    time.sleep(0.5)

    # 6. Consultar a URI de example.service2 no NameServer
    lookup_uri2 = ns.lookup("example.service2")
    print(f"[NameServer] lookup example.service2 → {lookup_uri2}")

    # 8. Criar proxy para o objeto remoto e chamar seus métodos
    proxy = Pyro5.api.Proxy(lookup_uri2)
    print("reverse('Olá Pyro'):", proxy.reverse("Olá Pyro"))
    print("count('Olá Pyro'):", proxy.count("Olá Pyro"))

    # Mantém o programa vivo para continuar atendendo requisições
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Daemon] Encerrando.")


if __name__ == "__main__":
    main()
