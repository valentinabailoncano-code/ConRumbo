const API_BASE = "http://localhost:8000/api";
const heard = document.getElementById("heard");
const apiStatus = document.getElementById("apiStatus");
const mode = document.getElementById("mode");
const btnSpeak = document.getElementById("btnSpeak");
const btnSend = document.getElementById("btnSend");
const manualText = document.getElementById("manualText");
const stepsList = document.getElementById("steps");
const protoTitle = document.getElementById("protoTitle");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnSaveFb = document.getElementById("btnSaveFb");
const feedback = document.getElementById("feedback");

let currentProtocol = null;
let stepIndex = 0;
let steps = [];
let sessionId = crypto.randomUUID();

// Comprobar API
fetch(`${API_BASE}/health`).then(()=> {
  apiStatus.textContent = "online ✅";
  mode.textContent = "online";
}).catch(()=>{
  apiStatus.textContent = "offline ❌";
  mode.textContent = "offline";
});

// Cargar protocolos locales para fallback
async function loadLocalProtocols() {
  // Versión mínima local (debe coincidir con backend/protocols.json si es posible)
  const local = {
    "pa_no_respira_v1": { "title":"Parada respiratoria (local)", "steps":[
      "Seguridad de la escena. Altavoz.",
      "Comprobar respuesta y respiración.",
      "Llamar 112 y empezar compresiones 100–120/min."
    ]},
    "pa_atragantamiento_v1": { "title":"Atragantamiento (local)", "steps":[
      "Anima a toser.",
      "5 golpes interescapulares.",
      "5 compresiones abdominales."
    ]}
  };
  localStorage.setItem("cr_protocols_local", JSON.stringify(local));
}
loadLocalProtocols();

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    speechSynthesis.speak(u);
  } catch (e) { /* sin TTS */ }
}

function renderSteps() {
  stepsList.innerHTML = "";
  steps.forEach((s, i) => {
    const li = document.createElement("li");
    li.textContent = s;
    if (i === stepIndex) li.style.fontWeight = "700";
    stepsList.appendChild(li);
  });
}

function setProtocol(title, arr) {
  protoTitle.textContent = title;
  steps = arr;
  stepIndex = 0;
  renderSteps();
  if (steps[0]) speak(steps[0]);
}

async function understandAndStart(text) {
  heard.textContent = "🗣️ Dije: " + text;
  // Intent → protocolo
  try {
    const r = await fetch(`${API_BASE}/understand`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ utterance: text, lang:"es", session_id: sessionId })
    });
    if (!r.ok) throw new Error("API error");
    const j = await r.json();
    currentProtocol = j.protocol_id;

    // Obtener protocolo completo del backend
    const r2 = await fetch(`${API_BASE}/protocol`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ protocol_id: currentProtocol })
    });

    if (r2.ok) {
      const p = await r2.json();
      setProtocol(p.title, p.steps);
      localStorage.setItem("last_protocol", JSON.stringify(p)); // cache
    } else {
      throw new Error("protocol not found");
    }
  } catch (e) {
    // Fallback offline
    mode.textContent = "offline";
    const cache = localStorage.getItem("last_protocol");
    const locals = localStorage.getItem("cr_protocols_local");
    if (cache) {
      const p = JSON.parse(cache);
      setProtocol(p.title + " (cache)", p.steps);
    } else if (locals) {
      // heurística: si texto contiene “atragant” usa atragantamiento; si “respira” usa no respira
      const L = JSON.parse(locals);
      const pick = text.includes("atragant") ? "pa_atragantamiento_v1" : "pa_no_respira_v1";
      const p = L[pick];
      setProtocol(p.title, p.steps);
    } else {
      setProtocol("Sin conexión", ["No hay protocolos disponibles."]);
    }
  }
}

btnSend.addEventListener("click", ()=> {
  const t = manualText.value.trim();
  if (t) understandAndStart(t);
});

btnPrev.addEventListener("click", ()=>{
  if (stepIndex > 0) {
    stepIndex -= 1;
    renderSteps();
    speak(steps[stepIndex]);
  }
});

btnNext.addEventListener("click", async ()=>{
  // Si estamos online, pedimos siguiente paso al backend para contar métricas
  if (mode.textContent === "online" && currentProtocol) {
    try {
      const r = await fetch(`${API_BASE}/next_step`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          protocol_id: currentProtocol,
          current_step: stepIndex,
          session_id: sessionId
        })
      });
      const j = await r.json();
      stepIndex = j.step_index;
    } catch (e) {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
    }
  } else {
    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  }
  renderSteps();
  speak(steps[stepIndex]);
});

// Voz del navegador (mantener pulsado)
let recognition;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "es-ES";
  recognition.interimResults = false;

  btnSpeak.addEventListener("mousedown", ()=> recognition.start());
  btnSpeak.addEventListener("touchstart", ()=> recognition.start());
  btnSpeak.addEventListener("mouseup", ()=> recognition.stop());
  btnSpeak.addEventListener("touchend", ()=> recognition.stop());

  recognition.onresult = (e)=>{
    const text = e.results[0][0].transcript;
    manualText.value = text;
    understandAndStart(text);
  };
  recognition.onerror = ()=> { /* silencio */ };
} else {
  btnSpeak.disabled = true;
  btnSpeak.textContent = "🎙️ Voz no soportada";
}

// Guardar feedback local
btnSaveFb.addEventListener("click", ()=>{
  const notes = JSON.parse(localStorage.getItem("cr_feedback") || "[]");
  notes.push({ ts: new Date().toISOString(), sessionId, feedback: feedback.value });
  localStorage.setItem("cr_feedback", JSON.stringify(notes));
  feedback.value = "";
  alert("Feedback guardado localmente ✅");
});
