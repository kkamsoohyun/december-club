#!/usr/bin/env python3
"""December Club 서버 — 정적 파일 + 작은 공유 API (외부 패키지 없음)

  python3 server.py [포트]         (기본: 환경변수 PORT, 없으면 5173)
  환경변수 DATA_DIR 로 저장 폴더를 바꿀 수 있음 (배포 시 영구 디스크 경로)

  POST   /api/member                    새 입장자에게 번호 발급 → {no, token}
  POST   /api/member/check {token}      내 번호 다시 확인 → {no}
  POST   /api/member/name {token, name} 닉네임 정하기 → {name}
  GET    /api/members/names             번호 → 닉네임 목록 {names}
  POST   /api/likes {tree, token?}      카드별 공감 수와 내가 눌렀는지 {likes: {id: [n, mine]}}
  POST   /api/like {token, id}          공감 누르기/취소 → {likes, mine}
  GET    /api/cards?tree=Friends        그 트리에 걸린 카드 목록
  POST   /api/cards                     카드 걸기 {token, tree, category, question, answer, slot}
  DELETE /api/cards {id, token}         내가 건 카드 떼기

데이터는 data/club.json 에 저장됩니다.
"""
import json
import os
import secrets
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR") or os.path.join(ROOT, "data")
DATA = os.path.join(DATA_DIR, "club.json")
TREES = {"Friends", "Family", "Growth", "Feeling", "Wish"}
MAX_ANSWER = 300
MAX_SLOTS = 200
MAX_NICK = 12
lock = threading.Lock()


def load():
    try:
        with open(DATA, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"next": 1, "members": {}, "cards": []}


def save(db):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA)


def public(card):
    return {k: v for k, v in card.items() if k != "token"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # data/ 폴더(토큰이 들어 있음)는 밖에서 못 보게
    def send_head(self):
        first = urlparse(self.path).path.lstrip("/").split("/")[0]
        if first in ("data", "server.py", "render.yaml") or first.startswith("."):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        else:
            self.send_header("Cache-Control", "no-cache")   # 고친 파일이 바로 보이게 (매번 새 버전 확인)
        super().end_headers()

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 20_000:
            return None
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return None

    def route(self):
        u = urlparse(self.path)
        return u.path, {k: v[0] for k, v in parse_qs(u.query).items()}

    def do_GET(self):
        path, q = self.route()
        if path == "/api/members/names":
            with lock:
                return self.reply(200, {"names": load().get("names", {})})
        if path == "/api/cards":
            tree = q.get("tree")
            with lock:
                cards = [public(c) for c in load()["cards"] if not tree or c["tree"] == tree]
            return self.reply(200, {"cards": cards})
        return super().do_GET()

    def do_POST(self):
        path, _ = self.route()
        data = self.body()
        if data is None:
            return self.reply(400, {"error": "bad json"})
        if path == "/api/member/check":
            with lock:
                no = load()["members"].get(str(data.get("token", "")))
            return self.reply(200, {"no": no}) if no else self.reply(404, {"error": "unknown"})
        if path == "/api/likes":
            with lock:
                db = load()
                me = db["members"].get(str(data.get("token", "")))
                ids = {c["id"] for c in db["cards"] if c["tree"] == data.get("tree")}
                likes = {i: [len(m), me in m] for i, m in db.get("likes", {}).items() if i in ids and m}
            return self.reply(200, {"likes": likes})
        if path == "/api/like":
            with lock:
                db = load()
                me = db["members"].get(str(data.get("token", "")))
                if not me:
                    return self.reply(403, {"error": "unknown member"})
                card = next((c for c in db["cards"] if c["id"] == data.get("id")), None)
                if not card:
                    return self.reply(404, {"error": "no card"})
                if card["member"] == me:
                    return self.reply(400, {"error": "own card"})
                who = db.setdefault("likes", {}).setdefault(card["id"], [])
                if me in who:
                    who.remove(me)
                else:
                    who.append(me)
                save(db)
            return self.reply(200, {"likes": len(who), "mine": me in who})
        if path == "/api/member/name":
            name = " ".join(str(data.get("name", "")).split())[:MAX_NICK]
            if not name:
                return self.reply(400, {"error": "empty nickname"})
            with lock:
                db = load()
                no = db["members"].get(str(data.get("token", "")))
                if not no:
                    return self.reply(403, {"error": "unknown member"})
                db.setdefault("names", {})[str(no)] = name
                save(db)
            return self.reply(200, {"name": name})
        if path == "/api/member":
            with lock:
                db = load()
                no = db["next"]
                token = secrets.token_urlsafe(18)
                db["next"] = no + 1
                db["members"][token] = no
                save(db)
            return self.reply(200, {"no": no, "token": token})
        if path == "/api/cards":
            tree = data.get("tree")
            answer = str(data.get("answer", "")).strip()[:MAX_ANSWER]
            if tree not in TREES or not answer:
                return self.reply(400, {"error": "bad card"})
            with lock:
                db = load()
                member = db["members"].get(data.get("token", ""))
                if not member:
                    return self.reply(403, {"error": "unknown member"})
                used = {c["slot"] for c in db["cards"] if c["tree"] == tree}
                slot = data.get("slot")
                if not isinstance(slot, int) or slot in used or not 0 <= slot < MAX_SLOTS:
                    slot = next(i for i in range(MAX_SLOTS + len(used) + 1) if i not in used)
                card = {
                    "id": secrets.token_hex(6),
                    "tree": tree,
                    "category": str(data.get("category", ""))[:60],
                    "question": str(data.get("question", ""))[:200],
                    "answer": answer,
                    "member": member,
                    "slot": slot,
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                    "token": data["token"],
                }
                db["cards"].append(card)
                save(db)
            return self.reply(200, {"card": public(card)})
        return self.reply(404, {"error": "not found"})

    def do_DELETE(self):
        path, _ = self.route()
        data = self.body()
        if path != "/api/cards" or data is None:
            return self.reply(404, {"error": "not found"})
        with lock:
            db = load()
            card = next((c for c in db["cards"] if c["id"] == data.get("id")), None)
            if not card:
                return self.reply(404, {"error": "no card"})
            if not secrets.compare_digest(card["token"], str(data.get("token", ""))):
                return self.reply(403, {"error": "not yours"})
            db["cards"].remove(card)
            db.get("likes", {}).pop(card["id"], None)
            save(db)
        return self.reply(200, {"ok": True})

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 5173))
    print(f"December Club → http://localhost:{port}")
    ThreadingHTTPServer(("", port), Handler).serve_forever()
