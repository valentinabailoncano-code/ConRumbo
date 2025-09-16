import csv
from datetime import datetime

class Metrics:
    def __init__(self, csv_path="metrics_log.csv"):
        self.csv_path = csv_path
        # Header si no existe
        try:
            with open(self.csv_path, "x", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["ts_iso","event","session_id","user_text","intent",
                                 "confidence","protocol_id","step_index","latency_ms"])
        except FileExistsError:
            pass

    def log(self, event, session_id="anon", user_text=None, intent=None,
            confidence=None, protocol_id=None, step_index=None, latency_ms=None):
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.utcnow().isoformat(timespec="seconds")+"Z",
                event, session_id, user_text, intent,
                confidence, protocol_id, step_index, latency_ms
            ])
