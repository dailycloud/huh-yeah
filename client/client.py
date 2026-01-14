from __future__ import annotations

import asyncio
import json
import pathlib
import webbrowser

from aiohttp import web, ClientSession, WSMsgType


BASE_DIR = pathlib.Path(__file__).resolve().parent
WEB_CLIENT_DIR = BASE_DIR / "web" / "client"


def ws_from_http(server_http: str) -> str:
    server_http = server_http.strip().rstrip("/")
    if server_http.startswith("https://"):
        return "wss://" + server_http[len("https://"):] + "/ws"
    if server_http.startswith("http://"):
        return "ws://" + server_http[len("http://"):] + "/ws"

    return "ws://" + server_http + "/ws"


async def ainput(prompt: str = "") -> str:
    return await asyncio.to_thread(input, prompt)


async def run_console(server_ws: str) -> None:
    nick = (await ainput("Ник: ")).strip() or "Guest"
    print("Пишешь сообщения и жмёшь Enter. /exit чтобы выйти.\n")

    async with ClientSession() as s:
        async with s.ws_connect(server_ws, heartbeat=25) as ws:
            await ws.send_str(json.dumps({"type": "set_nick", "nick": nick}, ensure_ascii=False))

            async def reader():
                async for msg in ws:
                    if msg.type != WSMsgType.TEXT:
                        continue
                    try:
                        data = json.loads(msg.data)
                    except Exception:
                        continue

                    t = data.get("type")
                    if t == "message":
                        print(f"\n[{data.get('nick')}] {data.get('text')}")
                        print("> ", end="", flush=True)
                    elif t == "system":
                        print(f"\n* {data.get('text')}")
                        print("> ", end="", flush=True)
                    elif t == "history":
                        print("\n* история загружена")
                        print("> ", end="", flush=True)

            task = asyncio.create_task(reader())

            try:
                while True:
                    line = (await ainput("> ")).rstrip("\n")
                    if line.strip() == "/exit":
                        break
                    if not line.strip():
                        continue
                    await ws.send_str(json.dumps({"type": "message", "text": line}, ensure_ascii=False))
            finally:
                task.cancel()
                try:
                    await ws.close()
                except Exception:
                    pass


async def web_index(request: web.Request) -> web.StreamResponse:
    return web.FileResponse(path=str(WEB_CLIENT_DIR / "index.html"))


def make_web_client_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", web_index)
    app.router.add_get("/client", web_index)
    app.router.add_get("/client/", web_index)
    app.router.add_static("/", str(WEB_CLIENT_DIR), show_index=False)
    return app


def patch_ws_url(server_http: str) -> None:
    cfg_path = WEB_CLIENT_DIR / "config.js"
    cfg_path.write_text(
        f'window.CHAT_SERVER_WS = "{ws_from_http(server_http)}";\n',
        encoding="utf-8",
    )


def main() -> None:
    server_http = (input("Адрес сервера (http://127.0.0.1:8000): ").strip() or "http://127.0.0.1:8000")
    server_ws = ws_from_http(server_http)

    print("\nВыбор клиента:")
    print("1) Консоль")
    print("2) Web GUI")
    choice = input("> ").strip()

    if choice == "1":
        asyncio.run(run_console(server_ws))
        return

    patch_ws_url(server_http)

    host = "127.0.0.1" 
    port = 8081
    url = f"http://{host}:{port}/client/"
    try:
        webbrowser.open(url)
    except Exception:
        pass

    web.run_app(make_web_client_app(), host=host, port=port)


if __name__ == "__main__":
    main()
