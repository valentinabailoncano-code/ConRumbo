'use strict';

// Resolve API base dynamically so mobile devices reach the backend.
const API_BASE = (() => {
  const override = (typeof window !== 'undefined' && (
    window.CONRUMBO_API_BASE ||
    new URLSearchParams(window.location.search).get('api_base') ||
    window.localStorage?.getItem('conrumbo.apiBase')
  )) || null;

  if (override) {
    const clean = override.replace(/\/$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  const { protocol, hostname } = window.location;
  const apiPort = 8000;
  const safeProtocol = protocol === 'https:' ? 'https:' : 'http:';
  const resolvedHost = (() => {
    // Browsers keep the literal host the user typed; translate wildcard hosts to loopback.
    if (!hostname || hostname === '0.0.0.0' || hostname === '[::]' || hostname === '::') {
      return '127.0.0.1';
    }
    return hostname;
  })();
  const portSegment = apiPort ? `:${apiPort}` : '';
  return `${safeProtocol}//${resolvedHost}${portSegment}/api`;
})();
const EMERGENCY_NUMBER = '112';
const TEST_NUMBER = '689876686';
const CALL_KEYWORDS = ['llamar', 'emergencia', '112', 'ambulancia', 'ayuda', 'socorro'];

const btnMic = document.getElementById('btnMic');
const statusEl = document.getElementById('status');
const liveTextEl = document.getElementById('liveText');
const stepsListEl = document.getElementById('stepsList');
const call112Btn = document.getElementById('btnCall112');
const callTestBtn = document.getElementById('btnCallTest');
const callButtons = [call112Btn, callTestBtn].filter(Boolean);
const configureApiBtn = document.getElementById('btnConfigureApi');
const micLabel = btnMic ? btnMic.querySelector('.mic-card__label') : null;

const modal = document.getElementById('callModal');
const modalClose = document.getElementById('modalClose');
const modalNumber = document.getElementById('modalNumber');
const modalTelLink = document.getElementById('modalTelLink');
const copyNumberBtn = document.getElementById('copyNumber');
const qrCanvas = document.getElementById('qrCanvas');

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
let recognitionRestartHold = false;
let recognitionShouldResume = false;
let recognitionPausePromise = null;
let recognitionPauseResolver = null;
let voicesReady = false;
let voicesReadyPromise = null;
let speechWarmupDone = false;
let speechWarmupPromise = null;

initSpeech();
checkHealth();
setupCallUi();
setupConfigUi();
primeSpeechVoices();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopListening();
    stopSpeaking();
    hideModal();
  }
});

btnMic.addEventListener('click', async () => {
  if (!recognition) {
    setStatus('Reconocimiento de voz no disponible en este navegador.');
    return;
  }
  if (listening) {
    stopListening();
  } else {
    try {
      await ensureSpeechReady();
    } catch (error) {
      console.warn('No se pudo preparar la voz', error);
    }
    startListening();
  }
});

if (callTestBtn) {
  callTestBtn.addEventListener('click', () => handleCallClick(TEST_NUMBER));
}

function setupCallUi() {
  if (call112Btn) {
    call112Btn.addEventListener('click', (event) => {
      if (!isMobile()) {
        event.preventDefault();
        handleCallClick(EMERGENCY_NUMBER);
      }
    });
  }

  modalClose.addEventListener('click', hideModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });

  copyNumberBtn.addEventListener('click', async () => {
    const number = modalNumber.textContent || '';
    try {
      await navigator.clipboard.writeText(number);
      copyNumberBtn.textContent = 'Copiado';
      setTimeout(() => {
        copyNumberBtn.textContent = 'Copiar numero';
      }, 1800);
    } catch (error) {
      setStatus('No se pudo copiar el numero.');
    }
  });
}

function setupConfigUi() {
  if (!configureApiBtn) {
    return;
  }

  const storedBase = (() => {
    try {
      return window.localStorage?.getItem('conrumbo.apiBase') || '';
    } catch (error) {
      console.warn('No se pudo leer la configuracion del servidor', error);
      return '';
    }
  })();

  if (storedBase) {
    configureApiBtn.title = `Servidor actual: ${storedBase}`;
  }

  configureApiBtn.addEventListener('click', () => {
    const currentBase = (window.localStorage?.getItem('conrumbo.apiBase') || storedBase || '').replace(/\/api$/, '');
    const input = window.prompt('Introduce la URL base del backend (por ejemplo http://192.168.1.50:8000)', currentBase);
    if (input === null) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      try {
        window.localStorage?.removeItem('conrumbo.apiBase');
        configureApiBtn.classList.remove('footer-link--alert');
        configureApiBtn.removeAttribute('title');
      } catch (error) {
        console.error('No se pudo limpiar la configuracion del servidor', error);
      }
      setStatus('Servidor predeterminado restablecido.');
      setTimeout(() => window.location.reload(), 200);
      return;
    }

    const normalized = trimmed.replace(/\/$/, '');
    const final = normalized.endsWith('/api') ? normalized : `${normalized}/api`;

    try {
      window.localStorage?.setItem('conrumbo.apiBase', final);
    } catch (error) {
      console.error('No se pudo guardar la configuracion del servidor', error);
    }

    configureApiBtn.title = `Servidor actual: ${final}`;
    setStatus('Servidor actualizado. Recargando...');
    setTimeout(() => window.location.reload(), 200);
  });
}

function ensureVoicesReady() {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve(false);
  }
  if (voicesReady) {
    return Promise.resolve(true);
  }
  if (!voicesReadyPromise) {
    const synth = window.speechSynthesis;
    voicesReadyPromise = new Promise((resolve) => {
      let timeoutId = null;
      function cleanup() {
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onVoicesChanged);
        } else if ('onvoiceschanged' in synth) {
          synth.onvoiceschanged = null;
        }
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      }
      function finalize(ready) {
        if (ready) {
          voicesReady = true;
        } else {
          voicesReady = false;
          voicesReadyPromise = null;
        }
        cleanup();
        resolve(ready);
      }
      function check() {
        try {
          const voices = synth.getVoices();
          if (voices && voices.length > 0) {
            finalize(true);
            return true;
          }
        } catch (error) {
          console.warn('No se pudieron leer las voces', error);
        }
        return false;
      }
      function onVoicesChanged() {
        check();
      }
      if (check()) {
        return;
      }
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoicesChanged);
      } else if ('onvoiceschanged' in synth) {
        synth.onvoiceschanged = onVoicesChanged;
      }
      timeoutId = window.setTimeout(() => finalize(false), 1500);
    });
  }
  return voicesReadyPromise;
}

function ensureSpeechReady() {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve(false);
  }
  if (speechWarmupDone) {
    return Promise.resolve(true);
  }
  if (speechWarmupPromise) {
    return speechWarmupPromise;
  }
  const synth = window.speechSynthesis;
  speechWarmupPromise = ensureVoicesReady().then(() => new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) {
        return;
      }
      settled = true;
      speechWarmupDone = ok;
      speechWarmupPromise = null;
      resolve(ok);
    };
    try {
      const utter = new SpeechSynthesisUtterance('...');
      utter.lang = 'es-ES';
      utter.volume = 0;
      utter.rate = 1;
      utter.pitch = 1;
      const fallback = window.setTimeout(() => finish(true), 700);
      utter.onend = () => {
        window.clearTimeout(fallback);
        finish(true);
      };
      utter.onerror = (event) => {
        window.clearTimeout(fallback);
        console.warn('Error durante la inicializacion de la voz', event.error || event);
        finish(false);
      };
      synth.speak(utter);
    } catch (error) {
      console.warn('No se pudo inicializar la voz', error);
      finish(false);
    }
  }));
  return speechWarmupPromise;
}

function primeSpeechVoices() {
  if (!('speechSynthesis' in window)) {
    return;
  }
  ensureVoicesReady().catch((error) => {
    console.warn('No se pudieron precargar las voces', error);
  });
}
function setMicState(state) {
  if (!btnMic) {
    return;
  }
  const isListening = state === 'listening';
  const isUnavailable = state === 'unavailable';
  const label = isUnavailable ? 'No disponible' : (isListening ? 'Detener' : 'Iniciar');

  btnMic.classList.toggle('is-listening', isListening);
  btnMic.disabled = isUnavailable;
  btnMic.setAttribute('aria-pressed', isListening ? 'true' : 'false');

  if (micLabel) {
    micLabel.textContent = label;
  } else {
    btnMic.textContent = label;
  }
}

function openModal(number) {
  modalNumber.textContent = number;
  modalTelLink.href = `tel:${number}`;
  modalTelLink.textContent = `Abrir marcador (${number})`;
  generateQr(`tel:${number}`);
  modal.classList.remove('hidden');
}

function hideModal() {
  modal.classList.add('hidden');
}

function handleCallClick(number) {
  if (isMobile()) {
    window.location.href = `tel:${number}`;
    return;
  }
  openModal(number);
}

function generateQr(data) {
  const size = qrCanvas.width = qrCanvas.height = 180;
  const ctx = qrCanvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, size, size);
  // Placeholder QR: simple pattern (no dependencies). Real QR generation can replace this.
  ctx.fillStyle = '#0f172a';
  for (let y = 0; y < size; y += 12) {
    for (let x = 0; x < size; x += 12) {
      const hash = (x * 13 + y * 7 + data.length * 11) % 5;
      if (hash === 0) {
        ctx.fillRect(x, y, 10, 10);
      }
    }
  }
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);
}

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('El reconocimiento de voz no es compatible con este dispositivo.');
    setMicState('unavailable');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.addEventListener('result', onSpeechResult);
  recognition.addEventListener('start', () => {
    setStatus('Escuchando...');
    setMicState('listening');
  });
  recognition.addEventListener('end', () => {
    if (recognitionPauseResolver) {
      const resolve = recognitionPauseResolver;
      recognitionPauseResolver = null;
      recognitionPausePromise = null;
      resolve();
    }
    if (!listening) {
      setStatus('Microfono detenido.');
      setMicState('ready');
      return;
    }
    if (recognitionRestartHold) {
      recognitionShouldResume = true;
      return;
    }
    try {
      recognition.start();
    } catch (error) {
      console.warn('No se pudo reiniciar el microfono', error);
      recognitionShouldResume = true;
    }
  });
  recognition.addEventListener('error', (event) => {
    setStatus('Error del microfono: ' + event.error);
    stopListening();
  });

  setMicState('ready');
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
    setStatus('Activando microfono...');
    setMicState('listening');
  } catch (error) {
    listening = false;
    setStatus('No se pudo iniciar el microfono: ' + error.message);
    setMicState('ready');
  }
}

function stopListening() {
  if (!recognition) {
    return;
  }
  recognitionRestartHold = false;
  recognitionShouldResume = false;
  if (recognitionPauseResolver) {
    recognitionPauseResolver();
    recognitionPauseResolver = null;
  }
  recognitionPausePromise = null;
  if (!listening) {
    playBeep(440, 0.12);
    setStatus('Microfono detenido.');
    setMicState('ready');
    return;
  }
  listening = false;
  try {
    recognition.stop();
  } catch (error) {
    // Ignorar
  }
  playBeep(440, 0.12);
  setStatus('Microfono detenido.');
  setMicState('ready');
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

function pauseRecognitionForSpeech() {
  if (!recognition || !listening) {
    recognitionRestartHold = false;
    recognitionShouldResume = false;
    return Promise.resolve();
  }
  // Pause recognition while we speak; otherwise some browsers mute TTS instantly.
  recognitionRestartHold = true;
  recognitionShouldResume = false;
  if (!recognitionPausePromise) {
    recognitionPausePromise = new Promise((resolve) => {
      recognitionPauseResolver = resolve;
    });
    try {
      recognition.stop();
    } catch (error) {
      recognitionRestartHold = false;
      if (recognitionPauseResolver) {
        recognitionPauseResolver();
        recognitionPauseResolver = null;
      }
      recognitionPausePromise = null;
      console.warn('No se pudo pausar el microfono', error);
    }
  }
  return recognitionPausePromise;
}

function handleSpeechFinished() {
  activeUtterance = null;
  const shouldRestart = recognitionShouldResume;
  recognitionRestartHold = false;
  recognitionShouldResume = false;
  // Resume the mic only after we finish speaking so we do not transcribe ourselves.
  if (!recognition || !listening || !shouldRestart) {
    return;
  }
  try {
    recognition.start();
  } catch (error) {
    console.warn('No se pudo reanudar el microfono', error);
  }
}

async function processUtterance(text) {
  if (supportsAbortController && pendingController) {
    pendingController.abort();
  }
  pendingController = supportsAbortController ? new AbortController() : null;

  stopSpeaking();
  setStatus('Procesando instruccion...');

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

    const stepText = nextStepData.step_text || 'No hay mas instrucciones disponibles.';
    await pauseRecognitionForSpeech();
    renderStep(stepText, protocolTitle, nextStepData.context?.step_index ?? null, nextStepData.total_steps);
    await speak(stepText);

    if (nextStepData.done) {
      setStatus('Protocolo completado. Espera ayuda profesional.');
    } else {
      setStatus('Instruccion lista. Puedes continuar hablando.');
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

  heading.textContent = title || 'Instruccion';
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

async function speak(text) {
  if (!('speechSynthesis' in window)) {
    handleSpeechFinished();
    return;
  }
  await ensureSpeechReady();
  stopSpeaking();
  activeUtterance = new SpeechSynthesisUtterance(text);
  activeUtterance.lang = 'es-ES';
  activeUtterance.pitch = 1;
  activeUtterance.rate = 1;
  activeUtterance.volume = 1;
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices && voices.length) {
    const lowerLang = (value) => (value || '').toLowerCase();
    const exact = voices.find((voice) => lowerLang(voice.lang) === 'es-es');
    const locale = voices.find((voice) => lowerLang(voice.lang).startsWith('es'));
    const contains = voices.find((voice) => lowerLang(voice.lang).includes('es'));
    activeUtterance.voice = exact || locale || contains || voices[0];
  }
  return new Promise((resolve) => {
    let resolved = false;
    const settle = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve();
    };
    activeUtterance.onstart = () => {
      settle();
    };
    activeUtterance.onend = (event) => {
      handleSpeechFinished();
      settle();
    };
    activeUtterance.onerror = (event) => {
      console.error('Error reproduciendo la instruccion', event.error || event);
      setStatus('No se pudo reproducir la instruccion en voz alta.');
      handleSpeechFinished();
      settle();
    };
    try {
      if (typeof synth.resume === 'function' && synth.paused) {
        synth.resume();
      }
      synth.speak(activeUtterance);
      window.setTimeout(() => settle(), 120);
    } catch (error) {
      console.error('No se pudo iniciar la reproduccion de la instruccion', error);
      setStatus('No se pudo reproducir la instruccion en voz alta.');
      handleSpeechFinished();
      settle();
    }
  });
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
    setStatus('Sistema listo. Pulsa el microfono para comenzar.');
    configureApiBtn?.classList.remove('footer-link--alert');
  } catch (error) {
    console.error('No se pudo verificar la API', error);
    setStatus('No se pudo conectar con la API. Pulsa "Configurar servidor" e introduce la direccion correcta.');
    configureApiBtn?.classList.add('footer-link--alert');
  }

}
