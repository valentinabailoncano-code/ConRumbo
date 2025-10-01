// ----- Config API dinámica (PC vs móvil) -----
const LAN_FALLBACK = "http://127.0.0.1:8000/api";
const API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? LAN_FALLBACK
  : `http://${location.hostname}:8000/api`; // abrir en móvil usando IP del PC

// ----- Selectores -----
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
const btnHands = document.getElementById("btnHands");
const btnMetronome = document.getElementById("btnMetronome");
const btnContrast = document.getElementById("btnContrast");
const btnLang = document.getElementById("btnLang");
const btnInstall = document.getElementById("btnInstall");
const btnSendFb = document.getElementById("btnSendFb");
const feedback = document.getElementById("feedback");
const disambBox = document.getElementById("disamb");

let currentProtocol = null;
let stepIndex = 0;
let steps = [];
let sessionId = crypto.randomUUID();
let handsFree = false;
let handsTimer = null;
let lang = localStorage.getItem("cr_lang") || "es";
let highContrast = false;

// ----- i18n muy simple -----
const STR = {
  es: {
    next: "Siguiente paso",
    prev: "Paso anterior",
    confirmCritical: "Este paso es sensible. ¿Deseas continuar?",
    lowConfidence: "¿Es esto lo que ocurre? Elige para confirmar:",
    protoUnknown: "Sin conexión: protocolo reducido.",
  },
  en: {
    next: "Next step",
    prev: "Previous step",
    confirmCritical: "This step is sensitive. Do you want to continue?",
    lowConfidence: "Is this what's happening? Tap to confirm:",
    protoUnknown: "Offline: reduced protocol.",
  }
};
const T = (k)=> (STR[lang][k] || STR.es[k]);

// ----- PWA: registrar SW -----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

// Detectar instalable (PWA)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.classList.remove('hidden');
});
btnInstall.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.classList.add('hidden');
  }
});

// ----- Ping API -----
fetch(`${API_BASE}/health`).then(()=> {
  apiStatus.textContent = "online ✅";
  mode.textContent = "online";
}).catch(()=>{
  apiStatus.textContent = "offline ❌";
  mode.textContent = "offline";
});

// ----- Utilidades -----
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = (lang==='en'?'en-US':'es-ES'); speechSynthesis.speak(u); } catch {}
}
function vibrate(ms){ if (navigator.vibrate) navigator.vibrate(ms); }

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
  if (steps[0]) { speak(steps[0]); }
}

// ----- Manos libres -----
function startHandsFree(){
  if (handsTimer) clearInterval(handsTimer);
  handsTimer = setInterval(()=>{
    // auto-avanza cada 25s (tiempo orientativo para ejecutar un paso)
    if (stepIndex < steps.length-1) {
      stepIndex++;
      renderSteps(); speak(steps[stepIndex]); vibrate(100);
    } else { stopHandsFree(); }
  }, 25000);
}
function stopHandsFree(){ if (handsTimer) clearInterval(handsTimer); handsTimer=null; }

// ----- Metrónomo 110 bpm -----
let metroTimer=null, audioCtx=null;
function beep(){
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type="square"; o.frequency.value=880;
  g.gain.setValueAtTime(0.2, audioCtx.currentTime);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+0.03);
  vibrate(40);
}
function startMetronome(){
  const interval = 60000/110; // 545ms aprox
  if (metroTimer) clearInterval(metroTimer);
  metroTimer = setInterval(beep, interval);
}
function stopMetronome(){ if (metroTimer) clearInterval(metroTimer); metroTimer=null; }

// ----- Desambiguación y confirmaciones -----
function showDisambiguation(options){
  disambBox.innerHTML = `<p>${T('lowConfidence')}</p>`;
  options.forEach(op=>{
    const b=document.createElement('button'); b.textContent=op.label; 
    b.onclick=()=> { disambBox.classList.add('hidden'); understandAndStart(op.example); };
    disambBox.appendChild(b);
  });
  disambBox.classList.remove('hidden');
}
function isCriticalStep(text){
  const keys = ["torniquete","ventilaciones","descarga","DEA","compresiones","abdominales"];
  return keys.some(k=> text.toLowerCase().includes(k));
}

// ----- Entendimiento + carga de protocolo -----
async function understandAndStart(text) {
  heard.textContent = "🗣️ Dije: " + text;

  try {
    const r = await fetch(`${API_BASE}/understand`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ utterance: text, lang, session_id: sessionId })
    });
    if (!r.ok) throw new Error("API error");
    const j = await r.json();

    // Desambiguación si confianza < 0.8
    if (j.confidence < 0.8) {
      showDisambiguation([
        {label:"No respira", example:"no respira"},
        {label:"Atragantamiento", example:"se atraganta"},
        {label:"Sangra mucho", example:"mucha sangre"}
      ]);
    } else {
      disambBox.classList.add('hidden');
    }

    currentProtocol = j.protocol_id;
    const r2 = await fetch(`${API_BASE}/protocol`, {
      method: "POST", headers: {"Content-Type":"application/json"},
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
    mode.textContent = "offline";
    const cache = localStorage.getItem("last_protocol");
    if (cache) {
      const p = JSON.parse(cache);
      setProtocol(p.title + " (cache)", p.steps);
    } else {
      setProtocol(T('protoUnknown'), ["Llama al 112.", "Comprueba respiración.", "Inicia RCP si es necesario."]);
    }
  }
}

// ----- Eventos UI -----
btnSend.addEventListener("click", ()=> {
  const t = manualText.value.trim();
  if (t) understandAndStart(t);
});
btnPrev.addEventListener("click", ()=>{
  if (stepIndex > 0) { stepIndex -= 1; renderSteps(); speak(steps[stepIndex]); }
});
btnNext.addEventListener("click", async ()=>{
  // Confirmación crítica
  const nextIdx = Math.min(stepIndex+1, steps.length-1);
  if (isCriticalStep(steps[nextIdx])) {
    if (!confirm(T('confirmCritical'))) return;
  }

  if (mode.textContent.includes("online") && currentProtocol) {
    try {
      const r = await fetch(`${API_BASE}/next_step`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ protocol_id: currentProtocol, current_step: stepIndex, session_id: sessionId })
      });
      const j = await r.json();
      stepIndex = j.step_index;
    } catch { stepIndex = nextIdx; }
  } else { stepIndex = nextIdx; }
  renderSteps(); speak(steps[stepIndex]); vibrate(80);
});

btnHands.addEventListener("click", ()=>{
  handsFree = !handsFree;
  if (handsFree){ btnHands.textContent="👐 Manos libres: ON"; startHandsFree(); }
  else { btnHands.textContent="👐 Manos libres: OFF"; stopHandsFree(); }
});

btnMetronome.addEventListener("click", ()=>{
  if (metroTimer){ stopMetronome(); btnMetronome.textContent="🫀 RCP 110 bpm: OFF"; }
  else { startMetronome(); btnMetronome.textContent="🫀 RCP 110 bpm: ON"; }
});

btnContrast.addEventListener("click", ()=>{
  highContrast = !highContrast;
  document.documentElement.classList.toggle("high-contrast", highContrast);
});

btnLang.addEventListener("click", ()=>{
  lang = (lang === "es" ? "en" : "es");
  localStorage.setItem("cr_lang", lang);
  btnLang.textContent = "Idioma: " + (lang.toUpperCase());
  alert(lang==="es" ? "Idioma cambiado a Español" : "Language set to English");
});

btnSendFb.addEventListener("click", async ()=>{
  try{
    await fetch(`${API_BASE}/feedback`, { method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ session_id: sessionId, notes: feedback.value }) });
    feedback.value=""; alert("Gracias por tu feedback ✅");
  }catch{ alert("No se pudo enviar (offline)."); }
});

// ----- Voz del navegador -----
let recognition;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = (lang==='en'?'en-US':'es-ES');
  recognition.interimResults = false;
  btnSpeak.addEventListener("mousedown", ()=> recognition.start());
  btnSpeak.addEventListener("touchstart", ()=> recognition.start(), {passive:true});
  btnSpeak.addEventListener("mouseup", ()=> recognition.stop());
  btnSpeak.addEventListener("touchend", ()=> recognition.stop());
  recognition.onresult = (e)=>{ const text = e.results[0][0].transcript; manualText.value = text; understandAndStart(text); };
  recognition.onerror = ()=> {};
} else {
  btnSpeak.disabled = true;
  btnSpeak.textContent = "🎙️ Voz no soportada";}