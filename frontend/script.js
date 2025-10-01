'use strict';

const API_BASE = 'http://127.0.0.1:8000/api';
const CALL_KEYWORDS = ['llamar', 'emergencia', '112', 'ambulancia', 'ayuda', 'socorro'];

const btnMic = document.getElementById('btnMic');
const statusEl = document.getElementById('status');
const liveTextEl = document.getElementById('liveText');
const stepsListEl = document.getElementById('stepsList');
const call112Btn = document.getElementById('btnCall112');
const callTestBtn = document.getElementById('btnCallTest');
const callButtons = [call112Btn, callTestBtn].filter(Boolean);

const sessionId = (crypto && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const supportsAbortController = typeof AbortController !== 'undefined';

let recognition;
let listening = false;
let audioCtx;
let highlightTimer = null;
let lastFinalTranscript = '';
let activeUtterance = null;
let currentIntent = null;
let currentContext = null;
let protocolTitle = '';
let pendingController = null;

initSpeech();
checkHealth();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopListening();
    stopSpeaking();
  }
});

btnMic.addEventListener('click', () => {
  if (!recognition) {
    setStatus('Reconocimiento de voz no disponible en este navegador.');
    return;
  }
  if (listening) {
    stopListening();
  } else {
    startListening();
  }
});

window.callTest = async function callTest() {
  const number = '689876686';
  if (isMobile()) {
    setStatus('Abriendo marcador...');
    window.location.href = `tel:${number}`;
    return;
  }
  setStatus('Solicitando llamada de prueba...');
  try {
    const response = await fetch(`${API_BASE}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: number })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo iniciar la llamada.');
    }
    setStatus('Llamada de prueba en curso.');
  } catch (error) {
    setStatus(`Error al iniciar la llamada: ${error.message}`);
  }
};

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('El reconocimiento de voz no es compatible con este dispositivo.');
    btnMic.disabled = true;
    btnMic.textContent = 'Micrófono no disponible';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.addEventListener('result', onSpeechResult);
  recognition.addEventListener('start', () => {
    setStatus('Escuchando...');
    btnMic.textContent = '⏹️ Detener';
  });
  recognition.addEventListener('end', () => {
    if (listening) {
      recognition.start();
    } else {
      setStatus('Micrófono detenido.');
      btnMic.textContent = '🎙️ Iniciar';
    }
  });
  recognition.addEventListener('error', (event) => {
    setStatus(`Error del micrófono: ${event.error}`);
    stopListening();
  });
}

function startListening() {
  if (!recognition || listening) {
    return;
  }
  listening = true;
  lastFinalTranscript = '';
  playBeep(880, 0.12);
  try {
    recognition.start();
    setStatus('Activando micrófono...');
  } catch (error) {
    listening = false;
    setStatus(`No se pudo iniciar el micrófono: ${error.message}`);
  }
  btnMic.textContent = '⏹️ Detener';
}

function stopListening() {
  if (!recognition) {
    return;
  }
  if (!listening) {
    playBeep(440, 0.12);
    setStatus('Micrófono detenido.');
    btnMic.textContent = '🎙️ Iniciar';
    return;
  }
  listening = false;
  try {
    recognition.stop();
  } catch (error) {
    // Ignorar
  }
  playBeep(440, 0.12);
  setStatus('Micrófono detenido.');
  btnMic.textContent = '🎙️ Iniciar';
}

function onSpeechResult(event) {
  let interimTranscript = '';
  let finalTranscript = '';

  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    const transcript = result[0].transcript;
    if (result.isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }

  if (interimTranscript) {
    liveTextEl.textContent = interimTranscript.trim();
  }

  const cleanedFinal = finalTranscript.trim();
  if (!cleanedFinal || cleanedFinal === lastFinalTranscript) {
    return;
  }

  lastFinalTranscript = cleanedFinal;
  liveTextEl.textContent = cleanedFinal;
  checkForCallKeywords(cleanedFinal);
  processUtterance(cleanedFinal);
}

async function processUtterance(text) {
  if (supportsAbortController && pendingController) {
    pendingController.abort();
  }
  pendingController = supportsAbortController ? new AbortController() : null;

  stopSpeaking();
  setStatus('Procesando instrucción...');

  try {
    const understandResponse = await fetch(`${API_BASE}/understand`, {
      method: 'POST',
      signal: pendingController?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        session_id: sessionId,
        context: currentContext
      })
    });

    if (!understandResponse.ok) {
      throw new Error('No se pudo interpretar la frase.');
    }

    const understandData = await understandResponse.json();
    currentIntent = understandData.intent || null;
    currentContext = understandData.context || null;

    const nextStepResponse = await fetch(`${API_BASE}/next_step`, {
      method: 'POST',
      signal: pendingController?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: currentIntent,
        context: currentContext,
        session_id: sessionId
      })
    });

    if (!nextStepResponse.ok) {
      const payload = await nextStepResponse.json().catch(() => ({}));
      throw new Error(payload.error || 'No se pudo obtener el siguiente paso.');
    }

    const nextStepData = await nextStepResponse.json();
    currentContext = nextStepData.context || currentContext;
    protocolTitle = nextStepData.title || protocolTitle;

    const stepText = nextStepData.step_text || 'No hay más instrucciones disponibles.';
    renderStep(stepText, protocolTitle, nextStepData.context?.step_index ?? null, nextStepData.total_steps);
    speak(stepText);

    if (nextStepData.done) {
      setStatus('Protocolo completado. Espera ayuda profesional.');
    } else {
      setStatus('Instrucción lista. Puedes continuar hablando.');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    setStatus(`Error: ${error.message}`);
  } finally {
    pendingController = null;
  }
}

function renderStep(text, title, stepIndex, totalSteps) {
  if (!text) {
    return;
  }
  const item = document.createElement('li');
  const heading = document.createElement('strong');
  const meta = document.createElement('span');

  heading.textContent = title || 'Instrucción';
  meta.className = 'step-meta';

  if (typeof stepIndex === 'number' && typeof totalSteps === 'number' && totalSteps > 0 && stepIndex >= 0) {
    meta.textContent = `Paso ${Math.min(stepIndex + 1, totalSteps)} de ${totalSteps}`;
  }

  const paragraph = document.createElement('p');
  paragraph.textContent = text;

  item.appendChild(heading);
  if (meta.textContent) {
    item.appendChild(meta);
  }
  item.appendChild(paragraph);

  stepsListEl.appendChild(item);
  while (stepsListEl.children.length > 8) {
    stepsListEl.removeChild(stepsListEl.firstElementChild);
  }

  item.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    return;
  }
  stopSpeaking();
  activeUtterance = new SpeechSynthesisUtterance(text);
  activeUtterance.lang = 'es-ES';
  activeUtterance.pitch = 1;
  activeUtterance.rate = 1;
  window.speechSynthesis.speak(activeUtterance);
}

function stopSpeaking() {
  if (!('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  activeUtterance = null;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function ensureAudioContext() {
  if (audioCtx) {
    return audioCtx;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  audioCtx = new AudioContextClass();
  return audioCtx;
}

function playBeep(frequency = 880, duration = 0.15) {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);
}

function checkForCallKeywords(text) {
  const normalized = text.toLowerCase();
  if (CALL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    highlightCallButtons();
  }
}

function highlightCallButtons() {
  callButtons.forEach((btn) => btn.classList.add('pulse'));
  if (highlightTimer) {
    clearTimeout(highlightTimer);
  }
  highlightTimer = setTimeout(() => {
    callButtons.forEach((btn) => btn.classList.remove('pulse'));
  }, 10000);
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!response.ok) {
      throw new Error();
    }
    setStatus('Sistema listo. Pulsa el micrófono para comenzar.');
  } catch (error) {
    setStatus('No se pudo conectar con la API. Comprueba el servidor.');
  }
}
