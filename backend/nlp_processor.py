import re
import difflib
from typing import Tuple

# Mapa de frases → intención
INTENT_SYNONYMS = {
    "parada_respiratoria": [
        "no respira", "no está respirando", "no respira nada", "no hay respiración",
        "dejó de respirar", "respiración ausente", "dejó de resp"
    ],
    "atragantamiento": [
        "se atraganta", "atragantamiento", "se ahoga", "ahogo", "obstrucción", "no puede respirar por comida"
    ],
    "hemorragia": [
        "sangra", "mucha sangre", "hemorragia", "sangrado", "sangra mucho"
    ],
    "inconsciente": [
        "no responde", "inconsciente", "desmayado", "no contesta", "se desmayó"
    ],
    "convulsiones": [
        "convulsiona", "convulsiones", "ataque epiléptico", "temblores"
    ],
    "quemadura": [
        "quemadura", "se quemó", "quemado", "quemadura grave"
    ],
}

# Intent por defecto si no hay match claro
FALLBACK_INTENT = "inconsciente"

def normalize(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"[^\wáéíóúüñ\s]", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t

def classify_text(text: str) -> Tuple[str, float]:
    """
    Devuelve (intent, confidence). Heurística simple + fuzzy match.
    """
    txt = normalize(text)
    if not txt:
        return (FALLBACK_INTENT, 0.3)

    # Exact/contains first
    for intent, phrases in INTENT_SYNONYMS.items():
        for p in phrases:
            if p in txt:
                return (intent, 0.95)

    # Fuzzy: mejor coincidencia entre todas las frases
    all_phrases = [(intent, p) for intent, lst in INTENT_SYNONYMS.items() for p in lst]
    best_intent, best_score = FALLBACK_INTENT, 0.0
    for intent, phrase in all_phrases:
        score = difflib.SequenceMatcher(None, txt, phrase).ratio()
        if score > best_score:
            best_score, best_intent = score, intent

    # Ajuste de confianza
    conf = 0.6 + (best_score * 0.4)
    return (best_intent, min(0.98, conf))
