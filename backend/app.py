from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from time import time
from typing import Any, Dict, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
import speech_recognition as sr

from nlp_processor import classify_text
from emergency_bot import BotEngine
from metrics import Metrics

BASE_DIR = Path(__file__).resolve().parent
ALLOWED_CORS_ORIGINS = [
    r"http://localhost(:\d+)?",
    r"https://localhost(:\d+)?",
    r"http://127\.0\.0\.1(:\d+)?",
    r"https://127\.0\.0\.1(:\d+)?",
    r"http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?",
    r"https://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?",
    r"http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?",
    r"https://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?",
    r"http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?",
    r"https://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?",
]
MAX_HISTORY_ITEMS = 20
MAX_SESSIONS = 1000
STT_SAMPLE_RATE = 16000

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {"origins": ALLOWED_CORS_ORIGINS},
        r"/*": {"origins": ALLOWED_CORS_ORIGINS},
    },
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
)

bot = BotEngine(protocols_path=BASE_DIR / "protocols.json")
metrics = Metrics(csv_path=BASE_DIR / "metrics_log.csv")

# Memoria en caliente para el contexto de cada sesion
_session_state: Dict[str, Dict[str, Any]] = {}
_runtime_config: Dict[str, Optional[str]] = {
    "backend_url": None,
    "voice_lang": "es-ES",
}


def _resolve_session(data: Dict[str, Any]) -> str:
    session_id = data.get("session_id") or data.get("sessionId")
    if not session_id:
        session_id = "anon"
    return str(session_id)


def _prune_sessions() -> None:
    if len(_session_state) <= MAX_SESSIONS:
        return
    _session_state.clear()


def _safe_suffix(filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext in {".wav", ".wave", ".webm", ".ogg", ".m4a", ".mp3"}:
        return ext
    return ".webm"


def _convert_to_wav(source_path: str, target_path: str) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg_not_available")
    process = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            source_path,
            "-ar",
            str(STT_SAMPLE_RATE),
            "-ac",
            "1",
            target_path,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError("ffmpeg_conversion_failed")


def _prepare_audio_file(upload) -> tuple[str, list[str]]:
    suffix = _safe_suffix(getattr(upload, "filename", "audio"))
    tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        upload.save(tmp_in.name)
    finally:
        tmp_in.close()

    cleanup: list[str] = [tmp_in.name]
    final_path = tmp_in.name

    if suffix not in {".wav", ".wave"}:
        tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        try:
            _convert_to_wav(tmp_in.name, tmp_out.name)
        except RuntimeError:
            tmp_out.close()
            cleanup_paths(cleanup)
            os.unlink(tmp_out.name)
            raise
        else:
            tmp_out.close()
            final_path = tmp_out.name
            cleanup.append(tmp_out.name)

    return final_path, cleanup


def cleanup_paths(paths: list[str]) -> None:
    for path in paths:
        try:
            os.unlink(path)
        except OSError:
            continue


def place_call(number: str) -> Dict[str, Any]:
    """Encapsula la integracion con el carrier o usa un mock en su defecto."""
    sanitized = str(number or "").strip()
    if not sanitized:
        raise ValueError("number_required")

    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    twiml_url = (
        os.getenv("TWILIO_TWIML_URL")
        or os.getenv("TWILIO_CALL_URL")
        or "http://demo.twilio.com/docs/voice.xml"
    )

    if account_sid and auth_token and from_number:
        try:
            from twilio.rest import Client  # type: ignore
        except ImportError as exc:  # pragma: no cover - depende de entorno
            app.logger.warning("Twilio no disponible: %s", exc)
        else:
            try:
                client = Client(account_sid, auth_token)
                call = client.calls.create(
                    to=sanitized,
                    from_=from_number,
                    url=twiml_url,
                )
                app.logger.info("Llamada enviada vía Twilio a %s", sanitized)
                return {"ok": True, "provider": "twilio", "sid": call.sid}
            except Exception as exc:  # pragma: no cover - depende del carrier
                app.logger.exception("Falló la llamada saliente a %s", sanitized)
                return {"ok": False, "error": str(exc)}

    app.logger.info("Simulando llamada (mock) a %s", sanitized)
    return {"ok": True, "provider": "mock"}


@app.get("/health")
def health() -> Any:
    return jsonify({"status": "ok"})


@app.get("/api/health")
def api_health():
    return jsonify({"ok": True})


@app.post("/call")
def call_endpoint():
    data = request.get_json(silent=True) or {}
    number = (data.get("to") or "").strip()
    if not number:
        return jsonify({"ok": False, "error": "missing_number"}), 400

    try:
        result = place_call(number)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    if not result.get("ok"):
        return jsonify({"ok": False, "error": result.get("error", "call_failed")}), 502

    app.logger.info("Llamada preparada para %s (%s)", number, result.get("provider", "mock"))
    return jsonify({"ok": True, "mode": result.get("provider", "mock")})


@app.post("/save-config")
def save_config():
    data = request.get_json(silent=True) or {}
    backend_url = data.get("backend_url")
    voice_lang = data.get("voice_lang")

    if backend_url is not None:
        _runtime_config["backend_url"] = str(backend_url).strip() or None
    if voice_lang is not None:
        _runtime_config["voice_lang"] = str(voice_lang).strip() or None

    app.logger.info(
        "Configuracion guardada: backend_url=%s voice_lang=%s",
        _runtime_config.get("backend_url"),
        _runtime_config.get("voice_lang"),
    )
    return jsonify({"ok": True, "config": _runtime_config})


@app.post("/api/stt")
def stt():
    upload = request.files.get("audio")
    if not upload:
        return jsonify({"error": "no-audio"}), 400

    cleanup: list[str] = []
    try:
        audio_path, cleanup = _prepare_audio_file(upload)
    except RuntimeError as error:
        status_code = 503 if str(error) == "ffmpeg_not_available" else 500
        return jsonify({"error": str(error)}), status_code

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(audio_path) as source:
            audio = recognizer.record(source)
        try:
            text = recognizer.recognize_google(audio, language="es-ES")
        except (sr.UnknownValueError, sr.RequestError):
            text = ""
    finally:
        cleanup_paths(cleanup)

    return jsonify({"text": text})


@app.post("/api/guide")
def guide():
    t0 = time()
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    session_id = _resolve_session(data)

    if not query:
        return jsonify({
            "step": 0,
            "text": "No he entendido. Por favor, repite la situación.",
            "say": "No he entendido. ¿Puedes repetir?",
            "next": True,
            "session_id": session_id,
        })

    intent, conf = classify_text(query)
    confidence_value = round(conf, 3) if conf is not None else None
    protocol_id = bot.intent_to_protocol(intent)
    protocol = bot.get_protocol(protocol_id)
    if not protocol:
        return jsonify({"error": "protocol_not_found"}), 404

    previous = _session_state.get(session_id, {})
    history = list(previous.get("history", []))
    history.append({"user_text": query, "intent": intent})
    if len(history) > MAX_HISTORY_ITEMS:
        history = history[-MAX_HISTORY_ITEMS:]

    previous_protocol = previous.get("protocol_id")
    previous_index = int(previous.get("step_index", -1))

    if previous_protocol != protocol_id:
        step_index = 0
    else:
        step_index = previous_index + 1

    steps = protocol.get("steps", [])
    total_steps = len(steps)

    if not steps:
        step_number = 0
        step_text = "No hay instrucciones disponibles en este momento."
        has_next = False
    else:
        if step_index >= total_steps:
            step_text = (
                "Has completado las instrucciones. Permanece con la persona y espera ayuda profesional."
            )
            step_number = total_steps
            step_index = total_steps - 1
            has_next = False
        else:
            step_text = steps[step_index]
            step_number = step_index + 1
            has_next = step_index < (total_steps - 1)

    context = {
        "protocol_id": protocol_id,
        "step_index": step_index,
        "history": history,
        "total_steps": total_steps,
    }
    _session_state[session_id] = context
    _prune_sessions()

    metrics.log(
        event="guide",
        session_id=session_id,
        user_text=query,
        intent=intent,
        confidence=confidence_value,
        protocol_id=protocol_id,
        step_index=step_index,
        latency_ms=int((time() - t0) * 1000),
    )

    return jsonify({
        "step": step_number,
        "text": step_text,
        "say": step_text,
        "next": has_next,
        "title": protocol.get("title", "Protocolo"),
        "session_id": session_id,
        "protocol_id": protocol_id,
        "confidence": confidence_value,
        "total_steps": total_steps,
    })


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


@app.before_serving
def _log_startup() -> None:
    app.logger.info("Flask listo en :8000")


if __name__ == "__main__":
    print("Flask listo en :8000")
    app.run(host="0.0.0.0", port=8000, debug=True)
