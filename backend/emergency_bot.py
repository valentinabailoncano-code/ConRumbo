import json
from typing import Dict, List

class BotEngine:
    def __init__(self, protocols_path: str):
        with open(protocols_path, "r", encoding="utf-8") as f:
            self.protocols: Dict[str, Dict] = json.load(f)

        # Mapa de intención → protocolo
        self.intent_protocol_map = {
            "parada_respiratoria": "pa_no_respira_v1",
            "atragantamiento": "pa_atragantamiento_v1",
            "hemorragia": "pa_hemorragia_v1",
            "inconsciente": "pa_inconsciente_v1",
            "convulsiones": "pa_convulsiones_v1",
            "quemadura": "pa_quemadura_v1"
        }

    def intent_to_protocol(self, intent: str) -> str:
        return self.intent_protocol_map.get(intent, "pa_inconsciente_v1")

    def get_protocol(self, protocol_id: str):
        return self.protocols.get(protocol_id)

    def next_step(self, protocol_id: str, current_step: int):
        proto = self.get_protocol(protocol_id)
        if not proto:
            return {"done": True, "error": "protocol_not_found"}

        steps: List[str] = proto["steps"]
        total = len(steps)
        if current_step >= total:
            return {"done": True, "step": "Protocolo finalizado.", "step_index": total, "total_steps": total}

        step = steps[current_step]
        return {
            "done": (current_step + 1) >= total,
            "step": step,
            "step_index": current_step + 1,
            "total_steps": total,
            "title": proto["title"]
        }
