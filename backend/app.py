from flask import Flask, request, jsonify
from flask_cors import CORS
from time import time
from nlp_processor import classify_text
from emergency_bot import BotEngine
from metrics import Metrics

app = Flask(__name__)
CORS(app)

bot = BotEngine(protocols_path="protocols.json")
metrics = Metrics(csv_path="metrics_log.csv")

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/understand")
def understand():
    t0 = time()
    data = request.get_json(force=True) or {}
    utter = data.get("utterance", "")
    session_id = data.get("session_id", "anon")
    intent, conf = classify_text(utter)
    proto = bot.intent_to_protocol(intent)
    metrics.log(event="understand",
                session_id=session_id,
                user_text=utter,
                intent=intent,
                confidence=conf,
                latency_ms=int((time()-t0)*1000))
    return jsonify({"intent": intent, "confidence": round(conf, 3), "protocol_id": proto})

@app.post("/api/next_step")
def next_step():
    t0 = time()
    data = request.get_json(force=True) or {}
    protocol_id = data.get("protocol_id")
    current_step = int(data.get("current_step", 0))
    out = bot.next_step(protocol_id, current_step)
    metrics.log(event="next_step",
                session_id=data.get("session_id","anon"),
                protocol_id=protocol_id,
                step_index=out.get("step_index"),
                latency_ms=int((time()-t0)*1000))
    return jsonify(out)

@app.post("/api/protocol")
def get_protocol():
    data = request.get_json(force=True) or {}
    proto = data.get("protocol_id")
    payload = bot.get_protocol(proto)
    return jsonify(payload), (200 if payload else 404)

@app.post("/api/feedback")
def feedback():
    """
    Body: {"session_id":"...", "ratings": {"clarity":5,"speed":4}, "notes":"..."}
    """
    data = request.get_json(force=True) or {}
    metrics.log(event="feedback",
                session_id=data.get("session_id","anon"),
                user_text=str(data.get("notes")),
                intent="",
                confidence="",
                protocol_id="",
                step_index="",
                latency_ms="")
    return jsonify({"ok": True})
    
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
