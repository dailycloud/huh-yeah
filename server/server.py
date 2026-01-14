#!/usr/bin/env python3
# server.py — Server ONLY (WebSocket chat + Admin dashboard + SQLite)
# Run: python server.py
# Admin: http://127.0.0.1:8000/admin/
# WS: ws://127.0.0.1:8000/ws

from __future__ import annotations

import asyncio
import json
import pathlib
import sqlite3
import time
import webbrowser
from dataclasses import dataclass
from typing import Dict, List, Optional

from aiohttp import web, WSMsgType


BASE_DIR = pathlib.Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
ADMIN_DIR = WEB_DIR / "admin"
DB_PATH = BASE_DIR / "chat.db"


def now_ms() -> int:
    return int(time.time() * 1000)


def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute(
            """CREATE TABLE IF NOT EXISTS messages(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts_ms INTEGER NOT NULL,
                nick TEXT NOT NULL,
                text TEXT NOT NULL
            )"""
        )
        con.commit()
    finally:
        con.close()


def db_add_message(nick: str, text: str) -> None:
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("INSERT INTO messages(ts_ms, nick, text) VALUES(?,?,?)", (now_ms(), nick, text))
        con.commit()
    finally:
        con.close()


def db_last_messages(limit: int = 200) -> List[dict]:
    con = sqlite3.connect(DB_PATH)
    try:
        cur = con.execute("SELECT ts_ms, nick, text FROM messages ORDER BY id DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        rows.reverse()
        return [{"ts_ms": ts, "nick": nick, "text": text} for (ts, nick, text) in rows]
    finally:
        con.close()


@dataclass(eq=False)  # important: must be hashable to store in a set (works "as before")
class Client:
    ws: web.WebSocketResponse
    nick: str = "Guest"
    joined_ms: int = 0


class Hub:
    def __init__(self) -> None:
        self.clients: dict[int, Client] = {}
        self.lock = asyncio.Lock()

    async def add(self, c: Client) -> None:
        async with self.lock:
            self.clients[id(c.ws)] = c

    async def remove(self, c: Client) -> None:
        async with self.lock:
            self.clients.pop(id(c.ws), None)

    async def broadcast(self, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False)
        dead: list[int] = []
        async with self.lock:
            for k, c in list(self.clients.items()):
                try:
                    await c.ws.send_str(data)
                except Exception:
                    dead.append(k)
            for k in dead:
                self.clients.pop(k, None)

    async def snapshot(self) -> dict:
        async with self.lock:
            lst = list(self.clients.values())
            lst.sort(key=lambda x: x.joined_ms)
            return {
                "clients": [{"nick": c.nick, "joined_ms": c.joined_ms} for c in lst],
                "clients_count": len(lst),
            }

hub = Hub()


# --------- HTTP handlers (ADMIN only) ----------
async def admin_index(request: web.Request) -> web.StreamResponse:
    # Always serve index.html for /admin/ so we DON'T see "Index of /"
    return web.FileResponse(path=str(ADMIN_DIR / "index.html"))


async def admin_state(request: web.Request) -> web.Response:
    snap = await hub.snapshot()
    msgs = db_last_messages(200)
    return web.json_response(
        {
            "ok": True,
            "time_ms": now_ms(),
            "clients": snap["clients"],
            "clients_count": snap["clients_count"],
            "messages": msgs,
            "messages_count": len(msgs),
        },
        dumps=lambda o: json.dumps(o, ensure_ascii=False),
    )


# --------- WebSocket chat ----------
async def ws_handler(request: web.Request) -> web.StreamResponse:
    ws = web.WebSocketResponse(heartbeat=25)
    await ws.prepare(request)

    client = Client(ws=ws, nick="Guest", joined_ms=now_ms())
    await hub.add(client)

    # Send history on connect
    await ws.send_str(json.dumps({"type": "history", "messages": db_last_messages(200)}, ensure_ascii=False))
    await hub.broadcast({"type": "system", "text": f"{client.nick} connected", "time_ms": now_ms()})

    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue

            try:
                data = json.loads(msg.data)
            except Exception:
                continue

            t = data.get("type")

            if t == "set_nick":
                new_nick = str(data.get("nick", "")).strip()[:24]
                if not new_nick:
                    new_nick = "Guest"
                old = client.nick
                client.nick = new_nick
                await hub.broadcast({"type": "system", "text": f"{old} -> {new_nick}", "time_ms": now_ms()})

            elif t == "message":
                text = str(data.get("text", "")).strip()
                if not text:
                    continue
                text = text[:500]
                db_add_message(client.nick, text)
                await hub.broadcast({"type": "message", "nick": client.nick, "text": text, "time_ms": now_ms()})

            elif t == "ping":
                await ws.send_str(json.dumps({"type": "pong", "time_ms": now_ms()}))

    finally:
        await hub.remove(client)
        await hub.broadcast({"type": "system", "text": f"{client.nick} disconnected", "time_ms": now_ms()})
        await ws.close()

    return ws


def make_app() -> web.Application:
    init_db()
    app = web.Application()

    # Admin UI
    app.router.add_get("/admin", admin_index)
    app.router.add_get("/admin/", admin_index)
    app.router.add_static("/admin/", path=str(ADMIN_DIR), show_index=False)

    # Admin API
    app.router.add_get("/api/admin/state", admin_state)

    # WebSocket endpoint for clients
    app.router.add_get("/ws", ws_handler)

    return app


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--host", default="26.230.187.243")
    p.add_argument("--port", default=8000, type=int)
    p.add_argument("--no-browser", action="store_true")
    args = p.parse_args()

    if not args.no_browser:
        try:
            webbrowser.open(f"http://{args.host}:{args.port}/admin/")
        except Exception:
            pass

    web.run_app(make_app(), host=args.host, port=args.port)
