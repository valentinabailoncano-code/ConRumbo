from __future__ import annotations

from pathlib import Path
from time import time
from typing import Any, Dict

from flask import Flask, request, jsonify
from flask_cors import CORS

from nlp_processor import classify_text
from emergency_bot import BotEngine
from metrics import Metrics

BASE_DIR = Path(__file__).resolve().parent
MAX_HISTORY_ITEMS = 20
MAX_SESSIONS = 1000

app = Flask(__name__)
CORS(app)

bot = BotEngine(protocols_path=BASE_DIR / "protocols.json")
metrics = Metrics(csv_path=BASE_DIR / "metrics_log.csv")

# Memoria en caliente para el contexto de cada sesión
_session_state: Dict[str, Dict[str, Any]] = {}


def _resolve_session(data: Dict[str, Any]) -> str:
    session_id = data.get("session_id") or data.get("sessionId")
    if not session_id:
        session_id = "anon"
    return str(session_id)


def _prune_sessions() -> None:
    if len(_session_state) <= MAX_SESSIONS:
        return
    _session_state.clear()


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/understand")
def understand():
    t0 = time()
    data = request.get_json(force=True) or {}
    utter = data.get("text") or data.get("utterance") or ""
    session_id = _resolve_session(data)

    intent, conf = classify_text(utter)
    protocol_id = bot.intent_to_protocol(intent)

    previous = _session_state.get(session_id, {})
    history = list(previous.get("history", []))
    if utter:
        history.append({"user_text": utter, "intent": intent})
        if len(history) > MAX_HISTORY_ITEMS:
            history = history[-MAX_HISTORY_ITEMS:]

    context = {
        "protocol_id": protocol_id,
        "step_index": -1,
        "history": history,
    }
    _session_state[session_id] = context
    _prune_sessions()

    metrics.log(
        event="understand",
        session_id=session_id,
        user_text=utter,
        intent=intent,
        confidence=conf,
        latency_ms=int((time() - t0) * 1000),
    )

    return jsonify({
        "intent": intent,
        "confidence": round(conf, 3),
        "context": context,
        "session_id": session_id,
    })


@app.post("/api/next_step")
def next_step():
    t0 = time()
    data = request.get_json(force=True) or {}
    session_id = _resolve_session(data)
    context = data.get("context") or _session_state.get(session_id) or {}

    protocol_id = context.get("protocol_id") or bot.intent_to_protocol(data.get("intent"))
    protocol = bot.get_protocol(protocol_id)
    if not protocol:
        return jsonify({"error": "protocol_not_found"}), 404

    steps = protocol.get("steps", [])
    total_steps = len(steps)

    current_index = int(context.get("step_index", -1)) + 1
    done = False
    if current_index >= total_steps:
        current_index = total_steps
        step_text = (
            "Has completado el protocolo. Permanece con la víctima y espera instrucciones profesionales."
        )
        done = True
    else:
        step_text = steps[current_index]
        done = current_index == (total_steps - 1)

    context.update({
        "protocol_id": protocol_id,
        "step_index": current_index,
    })
    _session_state[session_id] = context

    metrics.log(
        event="next_step",
        session_id=session_id,
        protocol_id=protocol_id,
        step_index=current_index,
        latency_ms=int((time() - t0) * 1000),
    )

    return jsonify({
        "step_text": step_text,
        "done": done,
        "total_steps": total_steps,
        "context": context,
        "title": protocol.get("title", "Protocolo"),
        "session_id": session_id,
    })


@app.post("/api/protocol")
def get_protocol():
    data = request.get_json(force=True) or {}
    proto = data.get("protocol_id")
    payload = bot.get_protocol(proto)
    return jsonify(payload), (200 if payload else 404)


@app.post("/api/feedback")
def feedback():
    data = request.get_json(force=True) or {}
    metrics.log(
        event="feedback",
        session_id=_resolve_session(data),
        user_text=str(data.get("notes")),
        intent="",
        confidence="",
        protocol_id="",
        step_index="",
        latency_ms="",
    )
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
