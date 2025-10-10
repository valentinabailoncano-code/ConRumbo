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

const btnMic = document.getElementById('btnMic') || document.getElementById('btnIniciar');
const statusEl = document.getElementById('status');
const liveTextEl = document.getElementById('liveText') || document.getElementById('transcripcion');
const stepsListEl = document.getElementById('stepsList') || document.getElementById('instrucciones');
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

const RawSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_IOS_DEVICE = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_CHROME_FAMILY = /Chrome|Edg|CriOS/i.test(navigator.userAgent);
const USE_BROWSER_SR = Boolean(RawSpeechRecognition) && IS_CHROME_FAMILY && !IS_IOS_DEVICE;
const USE_SERVER_SR = !USE_BROWSER_SR;
const GUIDE_URL = `${API_BASE}/guide`;
const STT_URL = `${API_BASE}/stt`;
const SERVER_STT_DURATION_MS = 5000;

let recognition;
let listening = false;
let audioCtx;
let highlightTimer = null;
let lastFinalTranscript = '';
let activeUtterance = null;
let pendingController = null;
let recognitionRestartHold = false;
let recognitionShouldResume = false;
let recognitionPausePromise = null;
let recognitionPauseResolver = null;
let voicesReady = false;
let voicesReadyPromise = null;
let speechWarmupDone = false;
let speechWarmupPromise = null;
let micPermissionGranted = false;
let serverRecorder = null;
let serverStream = null;
let serverChunks = [];
let serverStopTimer = null;
let serverAutoLoop = false;
let serverTranscribing = false;
let serverCancelled = false;

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

if (btnMic) {
  btnMic.addEventListener('click', async () => {
    if (listening || serverTranscribing) {
      stopListening();
      return;
    }

    try {
      await initAudioGesture();
      await ensureMicPermission();
    } catch (error) {
      console.error('No se pudo inicializar el audio/microfono', error);
      setStatus('Necesito acceso al audio para ayudarte.');
      return;
    }

    try {
      await speak('Estoy escuchando. ¿Cuál es la situación?');
    } catch (error) {
      console.warn('No se pudo reproducir el mensaje inicial', error);
    }

    startListening();
  });
}

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
  if (!USE_BROWSER_SR) {
    recognition = null;
    setStatus('Pulsa "Iniciar" para grabar tu voz y obtener ayuda.');
    setMicState('ready');
    return;
  }

  const SpeechRecognition = RawSpeechRecognition;
  if (!SpeechRecognition) {
    recognition = null;
    setStatus('El reconocimiento de voz no es compatible con este dispositivo.');
    setMicState('unavailable');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = false;

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
  if (USE_SERVER_SR) {
    startServerStt().catch((error) => {
      console.error('No se pudo iniciar la grabacion para STT', error);
      setStatus('No se pudo iniciar la grabacion. Intentalo de nuevo.');
      setMicState('ready');
    });
    return;
  }
  if (!recognition || listening) {
    if (!recognition) {
      setStatus('Reconocimiento de voz no disponible.');
    }
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
  if (USE_SERVER_SR) {
    stopServerStt();
    return;
  }
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

async function startServerStt() {
  if (serverTranscribing || listening) {
    return;
  }
  serverCancelled = false;
  serverChunks = [];
  setMicState('listening');
  setStatus('Preparando microfono...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    serverStream = stream;
    serverRecorder = createMediaRecorder(stream);
  } catch (error) {
    listening = false;
    serverTranscribing = false;
    setMicState('ready');
    throw error;
  }

  if (!serverRecorder) {
    listening = false;
    serverTranscribing = false;
    setMicState('ready');
    throw new Error('MediaRecorder no disponible para este navegador.');
  }

  listening = true;
  serverTranscribing = true;
  playBeep(880, 0.12);
  setStatus('Grabando... habla ahora.');

  serverRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      serverChunks.push(event.data);
    }
  });
  serverRecorder.addEventListener('stop', () => {
    window.clearTimeout(serverStopTimer);
    serverStopTimer = null;
    const recorderMime = serverRecorder && serverRecorder.mimeType ? serverRecorder.mimeType : '';
    const chunks = serverChunks.slice();
    cleanupServerStream();
    listening = false;

    if (serverCancelled) {
      serverChunks = [];
      serverTranscribing = false;
      setStatus('Microfono detenido.');
      setMicState('ready');
      return;
    }

    if (!chunks.length) {
      serverChunks = [];
      serverTranscribing = false;
      setStatus('No se capturo audio. Intentalo de nuevo.');
      setMicState('ready');
      return;
    }

    handleServerRecordingComplete(chunks, recorderMime).catch((error) => {
      console.error('No se pudo procesar el audio grabado', error);
      setStatus('No se pudo transcribir el audio.');
    });
  });

  try {
    serverRecorder.start();
  } catch (error) {
    cleanupServerStream();
    listening = false;
    serverTranscribing = false;
    setMicState('ready');
    throw error;
  }

  serverStopTimer = window.setTimeout(() => {
    if (serverRecorder && serverRecorder.state === 'recording') {
      try {
        serverRecorder.stop();
      } catch (error) {
        console.warn('No se pudo detener la grabacion automaticamente', error);
      }
    }
  }, SERVER_STT_DURATION_MS);
}

function stopServerStt() {
  if (!serverRecorder && !serverStream) {
    listening = false;
    serverTranscribing = false;
    setMicState('ready');
    return;
  }
  serverAutoLoop = false;
  serverCancelled = true;
  window.clearTimeout(serverStopTimer);
  serverStopTimer = null;
  if (serverRecorder && serverRecorder.state === 'recording') {
    try {
      serverRecorder.stop();
    } catch (error) {
      console.warn('No se pudo detener la grabacion', error);
    }
  } else {
    cleanupServerStream();
    serverChunks = [];
    listening = false;
    serverTranscribing = false;
    setMicState('ready');
    setStatus('Microfono detenido.');
  }
}

function cleanupServerStream() {
  if (serverStream) {
    serverStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        // Ignorar
      }
    });
  }
  serverStream = null;
  serverRecorder = null;
}

function createMediaRecorder(stream) {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    ''
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const type = candidates[i];
    if (type && typeof MediaRecorder.isTypeSupported === 'function' && !MediaRecorder.isTypeSupported(type)) {
      continue;
    }
    try {
      return type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    } catch (error) {
      // probar siguiente opcion
    }
  }
  return null;
}

async function handleServerRecordingComplete(chunks, mimeType) {
  let shouldRestart = false;
  const chunkType = chunks[0]?.type || '';
  const blobType = mimeType || chunkType || 'audio/webm';
  const audioBlob = new Blob(chunks, { type: blobType });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'input.webm');

  try {
    setStatus('Transcribiendo...');
    const response = await fetch(STT_URL, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      throw new Error(`stt-${response.status}`);
    }
    const payload = await response.json();
    const transcript = (payload.text || '').trim();

    liveTextEl.textContent = transcript || '—';
    if (!transcript) {
      serverAutoLoop = false;
      await speak('No he entendido. ¿Puedes repetir?');
      setStatus('No he entendido. Pulsa iniciar para intentarlo de nuevo.');
      return;
    }

    checkForCallKeywords(transcript);
    await processUtterance(transcript);
    shouldRestart = serverAutoLoop;
  } finally {
    serverChunks = [];
    serverTranscribing = false;
    if (shouldRestart) {
      startListening();
    } else {
      setMicState('ready');
    }
  }
}

async function ensureMicPermission() {
  if (micPermissionGranted) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micPermissionGranted = true;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      // Ignorar
    }
  });
}

async function initAudioGesture() {
  const ctx = ensureAudioContext();
  if (ctx && ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
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
    const guideResponse = await fetch(GUIDE_URL, {
      method: 'POST',
      signal: pendingController?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: text,
        lang: 'es-ES',
        session_id: sessionId
      })
    });

    if (!guideResponse.ok) {
      const payload = await guideResponse.json().catch(() => ({}));
      throw new Error(payload.error || 'No se pudo obtener la siguiente instruccion.');
    }

    const guideData = await guideResponse.json();
    const stepIndex = typeof guideData.step === 'number' ? guideData.step - 1 : null;
    const stepText = guideData.text || guideData.say || 'No hay mas instrucciones.';
    const speechText = guideData.say || guideData.text || stepText;
    const shouldContinue = Boolean(guideData.next);
    serverAutoLoop = shouldContinue;

    await pauseRecognitionForSpeech();
    renderGuideStep({
      step: typeof stepIndex === 'number' ? stepIndex + 1 : null,
      text: stepText,
      title: guideData.title,
      totalSteps: guideData.total_steps || guideData.totalSteps
    });

    if (USE_BROWSER_SR && !shouldContinue) {
      recognitionShouldResume = false;
    }

    if (speechText) {
      await speak(speechText);
    }

    if (USE_BROWSER_SR && !shouldContinue) {
      listening = false;
      setMicState('ready');
    }

    if (shouldContinue) {
      setStatus('Instruccion lista. Te escucho de nuevo.');
    } else {
      setStatus('Protocolo completado. Permanece atento a la ayuda profesional.');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    serverAutoLoop = false;
    setStatus(`Error: ${error.message}`);
  } finally {
    pendingController = null;
  }
}

function renderGuideStep(data) {
  if (!stepsListEl || !data) {
    return;
  }
  const stepNumber = typeof data.step === 'number' && data.step > 0 ? data.step : null;
  const displayText = (data.text || '').trim();
  if (!displayText) {
    return;
  }
  const item = document.createElement('li');
  const title = stepNumber ? `Paso ${stepNumber}` : (data.title || 'Instruccion');
  const description = document.createElement('p');
  const heading = document.createElement('span');
  heading.className = 'guide-step__title';
  heading.textContent = title;
  description.className = 'guide-step__text';
  description.textContent = displayText;

  item.className = 'guide-step';
  item.appendChild(heading);
  item.appendChild(description);

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
    setStatus('Sistema listo. Pulsa "Iniciar" para comenzar.');
    configureApiBtn?.classList.remove('footer-link--alert');
  } catch (error) {
    console.error('No se pudo verificar la API', error);
    setStatus('No se pudo conectar con la API. Pulsa "Configurar servidor" e introduce la direccion correcta.');
    configureApiBtn?.classList.add('footer-link--alert');
  }

}
