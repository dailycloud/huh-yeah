from __future__ import annotations

import pathlib
import webbrowser

from aiohttp import web

BASE_DIR       = pathlib.Path(__file__).resolve().parent
WEB_CLIENT_DIR = BASE_DIR / "web" / "client"

HOST = "127.0.0.1"
PORT = 8081


async def web_index(request: web.Request) -> web.StreamResponse:
    return web.FileResponse(WEB_CLIENT_DIR / "index.html")


def make_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/",        web_index)
    app.router.add_get("/client",  web_index)
    app.router.add_get("/client/", web_index)
    app.router.add_static("/", str(WEB_CLIENT_DIR), show_index=False)
    return app


def main() -> None:
    url = f"http://{HOST}:{PORT}/"
    print(f"Открываю {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    web.run_app(make_app(), host=HOST, port=PORT, print=None)


if __name__ == "__main__":
    main()
