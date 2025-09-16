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

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})

@app.route("/api/understand", methods=["POST"])
def understand():
    """
    Body: {"utterance":"no respira","lang":"es","session_id":"abc123"}
    Returns: {"intent":"parada_respiratoria","confidence":0.92,"protocol_id":"pa_no_respira_v1"}
    """
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
    return jsonify({
        "intent": intent,
        "confidence": round(conf, 3),
        "protocol_id": proto
    })

@app.route("/api/next_step", methods=["POST"])
def next_step():
    """
    Body: {"protocol_id":"pa_no_respira_v1","current_step":0}
    Returns: {"done": False, "step":"...", "step_index":1, "total_steps":7}
    """
    t0 = time()
    data = request.get_json(force=True) or {}
    protocol_id = data.get("protocol_id")
    current_step = int(data.get("current_step", 0))
    out = bot.next_step(protocol_id, current_step)
    metrics.log(event="next_step",
                session_id=data.get("session_id","anon"),
                protocol_id=protocol_id,
                step_index=out["step_index"],
                latency_ms=int((time()-t0)*1000))
    return jsonify(out)

@app.route("/api/protocol", methods=["POST"])
def get_protocol():
    """
    Body: {"protocol_id":"pa_hemorragia_v1"}
    Returns: {"title":"...","steps":[...]}
    """
    data = request.get_json(force=True) or {}
    proto = data.get("protocol_id")
    payload = bot.get_protocol(proto)
    return jsonify(payload), (200 if payload else 404)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
