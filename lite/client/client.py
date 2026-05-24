from __future__ import annotations

import argparse
import pathlib
import webbrowser

from aiohttp import web

BASE_DIR       = pathlib.Path(__file__).resolve().parent
WEB_CLIENT_DIR = BASE_DIR / "web" / "client"


async def web_index(request: web.Request) -> web.StreamResponse:
    return web.FileResponse(WEB_CLIENT_DIR / "index.html")


async def web_config(request: web.Request) -> web.Response:
    return web.json_response({"server": request.app["server_addr"]})


def make_app(server_addr: str) -> web.Application:
    app = web.Application()
    app["server_addr"] = server_addr
    
    app.router.add_get("/api/config", web_config)
    app.router.add_get("/",        web_index)
    app.router.add_get("/client",  web_index)
    app.router.add_get("/client/", web_index)
    app.router.add_static("/", str(WEB_CLIENT_DIR), show_index=False)
    return app


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="26.230.187.243:8000")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", default=8081, type=int)
    args = p.parse_args()

    url = f"http://{args.host}:{args.port}/"
    print(f"Открываю {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    
    web.run_app(make_app(args.server), host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
