'use strict';

const API_STORAGE_KEY = 'conrumbo.apiBase';
const BACKEND_URL_STORAGE_KEY = 'backend_url';
const BOOT_TIME_MARK = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? performance.now()
  : Date.now();

window.addEventListener('load', () => {
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const elapsed = Math.round(now - BOOT_TIME_MARK);
  log('Tiempo de arranque (ms):', elapsed);
});

// Resolve API base dynamically so mobile devices reach the backend.
const API_BASE = (() => {
  let storageOverride = null;
  if (typeof window !== 'undefined') {
    try {
      const storedBackend = hasLocalStorage() ? window.localStorage.getItem(BACKEND_URL_STORAGE_KEY) : null;
      const storedApi = hasLocalStorage() ? window.localStorage.getItem(API_STORAGE_KEY) : null;
      storageOverride = storedBackend || storedApi || null;
    } catch (error) {
      console.warn('No se pudo leer la configuracion del backend', error);
    }
  }

  const override = (typeof window !== 'undefined' && (
    window.CONRUMBO_API_BASE ||
    new URLSearchParams(window.location.search).get('api_base') ||
    storageOverride
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
const TEST_NUMBER = '+34689876686';
const CALL_KEYWORDS = {
  es: ['llamar', 'emergencia', '112', 'ambulancia', 'ayuda', 'socorro'],
  en: ['call', 'emergency', '112', 'help', 'ambulance', '911']
};

const btnMic = document.getElementById('btnMic') || document.getElementById('btnIniciar');
const statusEl = document.getElementById('status');
const liveTextEl = document.getElementById('liveText') || document.getElementById('transcripcion');
const stepsListEl = document.getElementById('stepsList') || document.getElementById('instrucciones');
const call112Btn = document.getElementById('btnCall112');
const callTestBtn = document.getElementById('btnCallTest');
const callButtons = [call112Btn, callTestBtn].filter(Boolean);
const configureApiBtn = document.getElementById('btnConfigureApi');
const settingBackendInput = document.getElementById('settingBackendUrl');
const saveBackendBtn = document.getElementById('saveBackendUrl');
const resetBackendBtn = document.getElementById('resetBackendUrl');
const currentServerLabel = document.getElementById('currentServerLabel');
const micLabel = btnMic ? btnMic.querySelector('.mic-card__label') : null;

const modal = document.getElementById('callModal');
const modalClose = document.getElementById('modalClose');
const modalNumber = document.getElementById('modalNumber');
const modalTelLink = document.getElementById('modalTelLink');
const copyNumberBtn = document.getElementById('copyNumber');
const qrCanvas = document.getElementById('qrCanvas');
const manualModal = document.getElementById('manualModal');
const manualModalClose = document.getElementById('manualModalClose');
const manualListEl = document.getElementById('manualList');
const manualDetailTitle = document.getElementById('manualLessonTitle');
const manualDetailSummary = document.getElementById('manualLessonSummary');
const manualStepsEl = document.getElementById('manualSteps');
const manualLessonExtra = document.getElementById('manualLessonExtra');
const btnManual = document.getElementById('btnManual');
const btnSettings = document.getElementById('btnSettings');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const settingThemeSelect = document.getElementById('settingTheme');
const settingLanguageSelect = document.getElementById('settingLanguage');
const ttsPlayer = document.getElementById('ttsPlayer');

// Compat helpers for older browsers (no optional chaining)
function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage;
  } catch (e) {
    return false;
  }
}

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
const SERVER_STT_DURATION_MS = 3000;
const MAX_SILENCE_AUTO_RETRIES = 2;
const PASSIVE_AUTO_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

const STORAGE_KEYS = {
  apiBase: API_STORAGE_KEY,
  backendUrl: BACKEND_URL_STORAGE_KEY,
  language: 'conrumbo.language',
  theme: 'conrumbo.theme'
};

const SUPPORTED_LANGUAGES = ['es', 'en'];
const LANGUAGE_FALLBACK = 'es';

const LANGUAGE_METADATA = {
  es: { locale: 'es-ES' },
  en: { locale: 'en-US' }
};

const TRANSLATIONS = {
  "es": {
    "app.documentTitle": "ConRumbo \u2014 Asistente de Emergencias (MVP)",
    "top.brand": "ConRumbo",
    "top.manual": "Manual",
    "top.settings": "Ajustes",
    "intro.heading": "Mant\u00e9n la calma.<br>Te guiar\u00e9 paso a paso.",
    "intro.status": "Inicializando...",
    "mic.buttonText": "Iniciar",
    "mic.stateStart": "Iniciar",
    "mic.stateStop": "Detener",
    "mic.stateUnavailable": "No disponible",
    "mic.subtitle": "Estoy aqu\u00ed para ayudarte. \u00bfCu\u00e1l es la situaci\u00f3n?",
    "mic.role": "ConRumbo Bot",
    "mic.transcriptionTitle": "Transcripci\u00f3n en vivo",
    "vitals.alert": "Herida detectada",
    "vitals.neutral": "Scanner 3D activo",
    "steps.header": "Instrucciones recientes",
    "steps.testCall": "Llamar TEST ({number})",
    "footer.call112": "Llamar al 112",
    "footer.disclaimer": "Este MVP no sustituye asistencia m\u00e9dica profesional. Llama al 112 ante cualquier duda.",
    "footer.configureServer": "Configurar servidor",
    "callModal.title": "Llamada de emergencia",
    "callModal.copy": "Copiar n\u00famero",
    "callModal.copied": "Copiado",
    "callModal.openDialer": "Abrir marcador",
    "callModal.openDialerWithNumber": "Abrir marcador ({number})",
    "callModal.hint": "Escanea el c\u00f3digo QR con tu m\u00f3vil para llamar r\u00e1pidamente.",
    "modal.closeLabel": "Cerrar",
    "manual.title": "Manual de maniobras",
    "manual.subtitle": "Selecciona una maniobra para ver los pasos.",
    "manual.emptyTitle": "Selecciona una lecci\u00f3n",
    "manual.emptyDescription": "Elige una maniobra del listado para ver el detalle.",
    "manual.tipsTitle": "Recomendaciones",
    "manual.stepPrefix": "Paso {number}",
    "manual.genericStep": "Instrucci\u00f3n",
    "settings.title": "Ajustes",
    "settings.appearance": "Apariencia",
    "settings.theme": "Modo de pantalla",
    "settings.themeOptionLight": "Modo d\u00eda",
    "settings.themeOptionDark": "Modo noche",
    "settings.themeOptionAuto": "Autom\u00e1tico",
    "settings.language": "Idioma",
    "settings.languageLabel": "Selecciona un idioma",
    "settings.languageOptionEs": "Espa\u00f1ol",
    "settings.languageOptionEn": "Ingl\u00e9s",
    "settings.languageInfo": "Los cambios se aplican de inmediato.",
    "settings.server": "Servidor",
    "settings.backendUrlLabel": "URL del backend",
    "settings.backendSave": "Guardar",
    "settings.backendReset": "Restaurar por defecto",
    "status.audioPermission": "Necesito acceso al audio para ayudarte.",
    "status.pressStart": "Pulsa \"Iniciar\" para grabar tu voz y obtener ayuda.",
    "status.srUnsupported": "El reconocimiento de voz no es compatible con este dispositivo.",
    "status.listening": "Escuchando...",
    "status.micStopped": "Micr\u00f3fono detenido.",
    "status.micError": "Error del micr\u00f3fono: {error}",
    "status.cannotStartRecording": "No se pudo iniciar la grabaci\u00f3n. Int\u00e9ntalo de nuevo.",
    "status.srUnavailable": "Reconocimiento de voz no disponible.",
    "status.activatingMic": "Activando micr\u00f3fono...",
    "status.micInitError": "No se pudo iniciar el micr\u00f3fono: {error}",
    "status.preparingMic": "Preparando micr\u00f3fono...",
    "status.recording": "Grabando... habla ahora.",
    "status.noAudio": "No se captur\u00f3 audio. Int\u00e9ntalo de nuevo.",
    "status.transcriptionFailed": "No se pudo transcribir el audio.",
    "status.transcribing": "Transcribiendo...",
    "status.noUnderstanding": "No he entendido. Pulsa iniciar para intentarlo de nuevo.",
    "status.processingInstruction": "Procesando instrucci\u00f3n...",
    "status.instructionReady": "Instrucci\u00f3n lista. Te escucho de nuevo.",
    "status.protocolCompleted": "Protocolo completado. Permanece atento a la ayuda profesional.",
    "status.speechFailed": "No se pudo reproducir la instrucci\u00f3n en voz alta.",
    "status.noMoreInstructions": "No hay m\u00e1s instrucciones.",
    "status.serverReset": "Servidor predeterminado restablecido.",
    "status.serverUpdated": "Servidor actualizado. Recargando...",
    "status.systemReady": "Sistema listo. Pulsa \"Iniciar\" para comenzar.",
    "status.apiUnavailable": "No se pudo conectar con la API. Pulsa \"Configurar servidor\" e introduce la direcci\u00f3n correcta.",
    "status.copyFailed": "No se pudo copiar el n\u00famero.",
    "status.errorWithMessage": "Error: {message}",
    "error.nextInstruction": "No se pudo obtener la siguiente instrucci\u00f3n.",
    "voice.initialPrompt": "Estoy escuchando. \u00bfCu\u00e1l es la situaci\u00f3n?",
    "voice.repeatPrompt": "No he entendido. \u00bfPuedes repetir?",
    "prompt.backendUrl": "Introduce la URL base del backend (por ejemplo http://192.168.1.50:8000)",
    "config.currentServer": "Servidor actual: {url}"
  },
  "en": {
    "app.documentTitle": "ConRumbo \u2014 Emergency Assistant (MVP)",
    "top.brand": "ConRumbo",
    "top.manual": "Playbook",
    "top.settings": "Settings",
    "intro.heading": "Stay calm.<br>I will guide you step by step.",
    "intro.status": "Initializing...",
    "mic.buttonText": "Start",
    "mic.stateStart": "Start",
    "mic.stateStop": "Stop",
    "mic.stateUnavailable": "Unavailable",
    "mic.subtitle": "I am here to help. What is the situation?",
    "mic.role": "ConRumbo Bot",
    "mic.transcriptionTitle": "Live transcription",
    "vitals.alert": "Detected injury",
    "vitals.neutral": "3D scanner active",
    "steps.header": "Latest instructions",
    "steps.testCall": "Call TEST ({number})",
    "footer.call112": "Call 112",
    "footer.disclaimer": "This MVP does not replace professional medical assistance. Call 112 if you are unsure.",
    "footer.configureServer": "Configure server",
    "callModal.title": "Emergency call",
    "callModal.copy": "Copy number",
    "callModal.copied": "Copied",
    "callModal.openDialer": "Open dialer",
    "callModal.openDialerWithNumber": "Open dialer ({number})",
    "callModal.hint": "Scan the QR code with your phone to dial quickly.",
    "modal.closeLabel": "Close",
    "manual.title": "Playbook",
    "manual.subtitle": "Pick a maneuver to review the steps.",
    "manual.emptyTitle": "Choose a lesson",
    "manual.emptyDescription": "Select a maneuver from the list to see the details.",
    "manual.tipsTitle": "Tips",
    "manual.stepPrefix": "Step {number}",
    "manual.genericStep": "Instruction",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.theme": "Display mode",
    "settings.themeOptionLight": "Day mode",
    "settings.themeOptionDark": "Night mode",
    "settings.themeOptionAuto": "Automatic",
    "settings.language": "Language",
    "settings.languageLabel": "Choose a language",
    "settings.languageOptionEs": "Spanish",
    "settings.languageOptionEn": "English",
    "settings.languageInfo": "Changes are applied instantly.",
    "settings.server": "Server",
    "settings.backendUrlLabel": "Backend URL",
    "settings.backendSave": "Save",
    "settings.backendReset": "Reset to default",
    "status.audioPermission": "I need access to audio to assist you.",
    "status.pressStart": "Press \"Start\" to record your voice and get help.",
    "status.srUnsupported": "Speech recognition is not supported on this device.",
    "status.listening": "Listening...",
    "status.micStopped": "Microphone stopped.",
    "status.micError": "Microphone error: {error}",
    "status.cannotStartRecording": "Could not start recording. Please try again.",
    "status.srUnavailable": "Speech recognition is unavailable.",
    "status.activatingMic": "Activating microphone...",
    "status.micInitError": "Microphone could not start: {error}",
    "status.preparingMic": "Preparing microphone...",
    "status.recording": "Recording... speak now.",
    "status.noAudio": "No audio captured. Please try again.",
    "status.transcriptionFailed": "We could not transcribe the audio.",
    "status.transcribing": "Transcribing...",
    "status.noUnderstanding": "I did not understand. Press start to try again.",
    "status.processingInstruction": "Processing instruction...",
    "status.instructionReady": "Instruction ready. I am listening again.",
    "status.protocolCompleted": "Protocol completed. Stay alert for professional help.",
    "status.speechFailed": "Could not read the instruction aloud.",
    "status.noMoreInstructions": "No more instructions available.",
    "status.serverReset": "Default server restored.",
    "status.serverUpdated": "Server updated. Reloading...",
    "status.systemReady": "System ready. Press \"Start\" to begin.",
    "status.apiUnavailable": "Unable to reach the API. Press \"Configure server\" and enter the correct address.",
    "status.copyFailed": "Could not copy the number.",
    "status.errorWithMessage": "Error: {message}",
    "error.nextInstruction": "Could not get the next instruction.",
    "voice.initialPrompt": "I am listening. What is happening?",
    "voice.repeatPrompt": "I did not understand. Can you repeat?",
    "prompt.backendUrl": "Enter the backend base URL (for example http://192.168.1.50:8000)",
    "config.currentServer": "Current server: {url}"
  }
};



const PLAYBOOK = [
  {
    "id": "adult-cpr",
    "translations": {
      "es": {
        "title": "RCP para adultos",
        "summary": "Reanima a una persona inconsciente sin respiraci\u00f3n eficaz.",
        "steps": [
          "Comprueba el entorno y confirma que es seguro para ti y la v\u00edctima.",
          "Revisa si responde y respira. Si no lo hace, llama al 112 o pide a alguien que lo haga.",
          "Coloca las manos en el centro del pecho y realiza 30 compresiones firmes a un ritmo de 100-120 por minuto.",
          "Inclina la cabeza hacia atr\u00e1s, levanta el ment\u00f3n y administra 2 ventilaciones de rescate observando la elevaci\u00f3n del pecho.",
          "Contin\u00faa con ciclos de 30 compresiones y 2 ventilaciones hasta que llegue ayuda o la persona recupere signos vitales."
        ],
        "tips": [
          "Utiliza un DEA en cuanto est\u00e9 disponible y sigue sus instrucciones.",
          "Si no te sientes seguro con las ventilaciones, mant\u00e9n compresiones continuas."
        ]
      },
      "en": {
        "title": "Adult CPR",
        "summary": "Resuscitate an unresponsive person who is not breathing normally.",
        "steps": [
          "Check that the area is safe for you and the victim.",
          "Look for responsiveness and breathing. If absent, call 112 or ask someone nearby to call.",
          "Place your hands on the center of the chest and deliver 30 firm compressions at 100-120 per minute.",
          "Tilt the head back, lift the chin, and give 2 rescue breaths while watching the chest rise.",
          "Continue 30 compressions and 2 breaths until help arrives or the person regains vital signs."
        ],
        "tips": [
          "Use an AED as soon as it is available and follow its prompts.",
          "If you are not confident giving breaths, continue hands-only compressions."
        ]
      }
    }
  },
  {
    "id": "choking-heimlich",
    "translations": {
      "es": {
        "title": "Atragantamiento (maniobra de Heimlich)",
        "summary": "Desobstruye la v\u00eda a\u00e9rea en una persona consciente que no puede respirar ni hablar.",
        "steps": [
          "Pregunta si se est\u00e1 atragantando y pide permiso para ayudar.",
          "Col\u00f3cate detr\u00e1s de la persona, rodea su cintura con los brazos y cierra un pu\u00f1o justo encima del ombligo.",
          "Sujeta el pu\u00f1o con la otra mano y realiza compresiones r\u00e1pidas hacia adentro y arriba.",
          "Repite las compresiones hasta que el objeto salga o la persona pueda respirar con normalidad.",
          "Si deja de responder, avisa al 112 y comienza RCP."
        ],
        "tips": [
          "Si la persona est\u00e1 embarazada o es obesa, realiza compresiones en el estern\u00f3n en lugar del abdomen.",
          "Para lactantes, alterna 5 palmadas en la espalda con 5 compresiones tor\u00e1cicas suaves."
        ]
      },
      "en": {
        "title": "Choking (Heimlich maneuver)",
        "summary": "Clear the airway of a conscious person who cannot breathe or speak.",
        "steps": [
          "Ask if they are choking and get permission to help.",
          "Stand behind the person, wrap your arms around their waist, and make a fist just above the navel.",
          "Grasp the fist with your other hand and pull sharply inward and upward.",
          "Repeat the thrusts until the object is expelled or the person breathes normally.",
          "If they stop responding, call 112 and begin CPR."
        ],
        "tips": [
          "If the person is pregnant or obese, perform chest thrusts on the sternum instead of abdominal thrusts.",
          "For infants, alternate 5 back slaps with 5 gentle chest compressions."
        ]
      }
    }
  },
  {
    "id": "recovery-position",
    "translations": {
      "es": {
        "title": "Posici\u00f3n lateral de seguridad",
        "summary": "Mant\u00e9n la v\u00eda a\u00e9rea abierta en una persona inconsciente que respira.",
        "steps": [
          "Arrod\u00edllate junto a la persona y estira el brazo m\u00e1s cercano en \u00e1ngulo recto con el cuerpo.",
          "Coloca el brazo m\u00e1s alejado cruzado sobre el pecho y dobla la rodilla m\u00e1s alejada.",
          "Sujeta la rodilla doblada y el hombro cercano, gira a la persona hacia ti hasta apoyarla de lado.",
          "Ajusta la cabeza para mantener la v\u00eda a\u00e9rea abierta y orientada hacia abajo para drenar fluidos.",
          "Comprueba regularmente la respiraci\u00f3n hasta la llegada de los servicios de emergencia."
        ],
        "tips": [
          "Si sospechas lesi\u00f3n de columna, evita moverla salvo que sea imprescindible para mantener la v\u00eda a\u00e9rea.",
          "Abr\u00edgala para conservar su temperatura corporal."
        ]
      },
      "en": {
        "title": "Recovery position",
        "summary": "Keep the airway open in an unconscious but breathing person.",
        "steps": [
          "Kneel beside the person and place the nearest arm at a right angle to the body.",
          "Bring the far arm across the chest and bend the far knee.",
          "Hold the bent knee and the near shoulder, then roll the person toward you until they rest on their side.",
          "Tilt the head back slightly to maintain the airway and face it downward to drain fluids.",
          "Check breathing regularly until emergency services arrive."
        ],
        "tips": [
          "If you suspect spinal injury, avoid moving them unless necessary to keep the airway open.",
          "Cover them to maintain body temperature."
        ]
      }
    }
  }
];




let lastStatusKey = null;
let lastStatusParams = null;
let currentLessonId = PLAYBOOK[0] ? PLAYBOOK[0].id : null;
let currentLanguage = detectInitialLanguage();
let themePreference = detectInitialTheme();
let systemDarkMatcher = null;

applyTheme(themePreference);
updateDocumentLanguage();
applyTranslationsToDom();


function detectInitialLanguage() {
  try {
    const stored = hasLocalStorage() ? window.localStorage.getItem(STORAGE_KEYS.language) : null;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('No se pudo leer el idioma almacenado', error);
  }
  const browser = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browser) ? browser : LANGUAGE_FALLBACK;
}

function detectInitialTheme() {
  try {
    const stored = hasLocalStorage() ? window.localStorage.getItem(STORAGE_KEYS.theme) : null;
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  } catch (error) {
    console.warn('No se pudo leer el tema almacenado', error);
  }
  return 'auto';
}

function getTranslations(lang) {
  return TRANSLATIONS[lang] || TRANSLATIONS[LANGUAGE_FALLBACK] || {};
}

function formatMessage(message, params = {}) {
  if (typeof message !== 'string') {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : {}
  ));
}

function t(key, params = {}) {
  const dict = getTranslations(currentLanguage);
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return formatMessage(dict[key], params);
  }
  const fallback = getTranslations(LANGUAGE_FALLBACK);
  if (Object.prototype.hasOwnProperty.call(fallback, key)) {
    return formatMessage(fallback[key], params);
  }
  return key;
}

function getCallKeywords() {
  return CALL_KEYWORDS[currentLanguage] || CALL_KEYWORDS[LANGUAGE_FALLBACK] || [];
}

function getCurrentLocale() {
  const meta = LANGUAGE_METADATA[currentLanguage] || LANGUAGE_METADATA[LANGUAGE_FALLBACK] || {};
  return meta.locale || 'es-ES';
}

function toggleThemeClass(isDark) {
  document.body.classList.toggle('theme-dark', Boolean(isDark));
}

function handleSystemThemeChange(event) {
  if (themePreference === 'auto') {
    toggleThemeClass(event.matches);
  }
}

function ensureSystemThemeListener() {
  if (systemDarkMatcher) {
    return;
  }
  const matcher = window.matchMedia('(prefers-color-scheme: dark)');
  systemDarkMatcher = matcher;
  if (typeof matcher.addEventListener === 'function') {
    matcher.addEventListener('change', handleSystemThemeChange);
  } else if (typeof matcher.addListener === 'function') {
    matcher.addListener(handleSystemThemeChange);
  }
}

function removeSystemThemeListener() {
  if (!systemDarkMatcher) {
    return;
  }
  if (typeof systemDarkMatcher.removeEventListener === 'function') {
    systemDarkMatcher.removeEventListener('change', handleSystemThemeChange);
  } else if (typeof systemDarkMatcher.removeListener === 'function') {
    systemDarkMatcher.removeListener(handleSystemThemeChange);
  }
  systemDarkMatcher = null;
}

function applyTheme(preference) {
  const normalized = preference === 'dark' || preference === 'light' ? preference : 'auto';
  themePreference = normalized;
  if (normalized === 'auto') {
    ensureSystemThemeListener();
    const matcher = systemDarkMatcher || window.matchMedia('(prefers-color-scheme: dark)');
    toggleThemeClass(matcher.matches);
  } else {
    removeSystemThemeListener();
    toggleThemeClass(normalized === 'dark');
  }
  if (settingThemeSelect && settingThemeSelect.value !== normalized) {
    settingThemeSelect.value = normalized;
  }
  try {
    if (hasLocalStorage()) { window.localStorage.setItem(STORAGE_KEYS.theme, normalized); }
  } catch (error) {
    console.warn('No se pudo guardar el tema seleccionado', error);
  }
}

function translateOptions(selectEl) {
  if (!selectEl) {
    return;
  }
  Array.from(selectEl.options).forEach((option) => {
    const key = option.getAttribute('data-i18n');
    if (key) {
      option.textContent = t(key);
    }
  });
}

function updateDocumentLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = t('app.documentTitle');
}

function applyTranslationsToDom() {
  const nodes = document.querySelectorAll('[data-i18n]');
  nodes.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const mode = element.getAttribute('data-i18n-mode');
    const value = t(key);
    if (mode === 'html') {
      element.innerHTML = value;
    } else {
      element.textContent = value;
    }
  });

  const ariaNodes = document.querySelectorAll('[data-i18n-aria]');
  ariaNodes.forEach((element) => {
    const key = element.getAttribute('data-i18n-aria');
    if (key) {
      element.setAttribute('aria-label', t(key));
    }
  });

  translateOptions(settingThemeSelect);
  translateOptions(settingLanguageSelect);

  const footerCallLabel = document.querySelector('.cta-primary__label');
  if (footerCallLabel) {
    footerCallLabel.textContent = t('footer.call112');
  }
  if (btnCallTest) {
    btnCallTest.textContent = t('steps.testCall', { number: TEST_NUMBER });
  }
  // Settings: server section translations
  if (settingBackendInput) {
    settingBackendInput.placeholder = t('prompt.backendUrl');
  }
  if (copyNumberBtn) {
    copyNumberBtn.textContent = t('callModal.copy');
  }
  if (manualModal && !manualModal.classList.contains('hidden')) {
    refreshManualContent();
  }
  refreshStatus();
}

function applyLanguage(languageCode) {
  const candidate = SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : LANGUAGE_FALLBACK;
  currentLanguage = candidate;
  if (settingLanguageSelect && settingLanguageSelect.value !== candidate) {
    settingLanguageSelect.value = candidate;
  }
  try {
    if (hasLocalStorage()) { window.localStorage.setItem(STORAGE_KEYS.language, candidate); }
  } catch (error) {
    console.warn('No se pudo guardar el idioma seleccionado', error);
  }
  if (recognition) {
    recognition.lang = getCurrentLocale();
  }
  applyTranslationsToDom();
}

function getLessonContent(lesson, language = currentLanguage) {
  if (!lesson || !lesson.translations) {
    return { title: '', summary: '', steps: [], tips: [] };
  }
  const content = lesson.translations[language] || lesson.translations[LANGUAGE_FALLBACK];
  return content || { title: '', summary: '', steps: [], tips: [] };
}

function updateManualActiveItem() {
  manualListButtons.forEach((button) => {
    const isActive = button.dataset.lessonId === currentLessonId;
    button.classList.toggle('manual-list__item--active', isActive);
  });
}

function renderManualList() {
  if (!manualListEl) {
    return;
  }
  manualListEl.innerHTML = '';
  manualListButtons = [];
  PLAYBOOK.forEach((lesson) => {
    const content = getLessonContent(lesson);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'manual-list__item';
    button.dataset.lessonId = lesson.id;

    const titleEl = document.createElement('span');
    titleEl.className = 'manual-list__item-title';
    titleEl.textContent = content.title;

    const summaryEl = document.createElement('span');
    summaryEl.className = 'manual-list__item-summary';
    summaryEl.textContent = content.summary;

    button.appendChild(titleEl);
    button.appendChild(summaryEl);
    button.addEventListener('click', () => {
      if (currentLessonId === lesson.id) {
        return;
      }
      currentLessonId = lesson.id;
      renderManualDetail();
      updateManualActiveItem();
    });

    manualListEl.appendChild(button);
    manualListButtons.push(button);
  });
  updateManualActiveItem();
}

function renderManualDetail() {
  if (!manualDetailTitle || !manualDetailSummary || !manualStepsEl || !manualLessonExtra) {
    return;
  }
  const lesson = PLAYBOOK.find((item) => item.id === currentLessonId);
  if (!lesson) {
    manualDetailTitle.textContent = t('manual.emptyTitle');
    manualDetailSummary.textContent = t('manual.emptyDescription');
    manualStepsEl.innerHTML = '';
    manualLessonExtra.innerHTML = '';
    return;
  }
  const content = getLessonContent(lesson);
  manualDetailTitle.textContent = content.title;
  manualDetailSummary.textContent = content.summary;

  manualStepsEl.innerHTML = '';
  (content.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    manualStepsEl.appendChild(li);
  });

  const tips = Array.isArray(content.tips) ? content.tips : [];
  manualLessonExtra.innerHTML = '';
  if (tips.length) {
    const heading = document.createElement('strong');
    heading.textContent = t('manual.tipsTitle');
    manualLessonExtra.appendChild(heading);

    const list = document.createElement('ul');
    tips.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      list.appendChild(li);
    });
    manualLessonExtra.appendChild(list);
  }
}

function refreshManualContent() {
  renderManualList();
  renderManualDetail();
}

function showManualModal() {
  if (!manualModal) {
    return;
  }
  refreshManualContent();
  manualModal.classList.remove('hidden');
  manualModal.setAttribute('aria-hidden', 'false');
}

function hideManualModal() {
  if (!manualModal) {
    return;
  }
  manualModal.classList.add('hidden');
  manualModal.setAttribute('aria-hidden', 'true');
}

function showSettingsModal() {
  if (!settingsModal) {
    return;
  }
  settingsModal.classList.remove('hidden');
  settingsModal.setAttribute('aria-hidden', 'false');
}

function hideSettingsModal() {
  if (!settingsModal) {
    return;
  }
  settingsModal.classList.add('hidden');
  settingsModal.setAttribute('aria-hidden', 'true');
}


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
// currentLessonId is initialized earlier from PLAYBOOK
let manualListButtons = [];
let serverShouldAutoRestart = false;
let autoSilenceRetryCount = 0;
let autoAssistTriggered = false;
let autoAssistArmed = false;
let permissionMonitor = null;
let autoAssistHandler = null;

checkHealth();
setupCallUi();
setupConfigUi();
primeSpeechVoices();
setupAutoAssist();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopListening();
    stopSpeaking();
    hideModal();
    hideManualModal();
    hideSettingsModal();
    resetAutoAssist();
  } else if (!listening && !serverTranscribing) {
    triggerAutoAssist().catch(() => {
      armPassiveAutoAssist();
    });
  }
});

if (btnMic) {
  btnMic.addEventListener('click', async () => {
    detachPassiveAutoAssist();
    if (listening || serverTranscribing) {
      stopListening();
      autoAssistTriggered = false;
      return;
    }
    try {
      const started = await beginAssistFlow({ fromUser: true });
      autoAssistTriggered = started;
      if (!started) {
        armPassiveAutoAssist();
      }
    } catch (error) {
      console.error('No se pudo inicializar el audio/microfono', error);
      autoAssistTriggered = false;
      armPassiveAutoAssist();
    }
  });
}

if (callTestBtn) {
  callTestBtn.addEventListener('click', () => handleCallClick(TEST_NUMBER));
}


if (btnManual) {
  btnManual.addEventListener('click', () => {
    if (settingThemeSelect) {
      settingThemeSelect.value = themePreference;
    }
    if (settingLanguageSelect) {
      settingLanguageSelect.value = currentLanguage;
    }
    showManualModal();
  });
}

if (manualModalClose) {
  manualModalClose.addEventListener('click', hideManualModal);
}

if (manualModal) {
  manualModal.addEventListener('click', (event) => {
    if (event.target === manualModal) {
      hideManualModal();
    }
  });
}

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      if (settingThemeSelect) {
        settingThemeSelect.value = themePreference;
      }
      if (settingLanguageSelect) {
        settingLanguageSelect.value = currentLanguage;
      }
      if (settingBackendInput) {
        settingBackendInput.value = getBackendURL();
      }
      if (currentServerLabel) {
        currentServerLabel.textContent = t('config.currentServer', { url: getBackendURL() });
      }
      showSettingsModal();
    });
  }

if (settingsModalClose) {
  settingsModalClose.addEventListener('click', hideSettingsModal);
}

if (settingsModal) {
  settingsModal.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
      hideSettingsModal();
    }
  });
}

if (settingThemeSelect) {
  settingThemeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
  });
}

if (settingLanguageSelect) {
  settingLanguageSelect.addEventListener('change', (event) => {
    applyLanguage(event.target.value);
  });
}

const manualText = document.getElementById('manualText');
const sendManual = document.getElementById('sendManual');
if (sendManual && manualText) {
  sendManual.addEventListener('click', async () => {
    const text = (manualText.value || '').trim();
    if (!text) return;
    liveTextEl.textContent = text;
    await processUtterance(text);
    manualText.value = '';
  });
}

refreshManualContent();

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
      copyNumberBtn.textContent = t('callModal.copied');
      setTimeout(() => {
        copyNumberBtn.textContent = t('callModal.copy');
      }, 1800);
    } catch (error) {
      setStatusKey('status.copyFailed');
    }
  });
}

function setupConfigUi() {
  // Footer button is optional; server config is now inside Settings modal.
  if (!configureApiBtn) {
    // still initialize Settings modal controls if present
    initSettingsServerControls();
    return;
  }

  const storedBase = (() => {
    try {
      const backend = hasLocalStorage() ? window.localStorage.getItem(STORAGE_KEYS.backendUrl) : null;
      if (backend) {
        return backend;
      }
      const legacy = hasLocalStorage() ? (window.localStorage.getItem(API_STORAGE_KEY) || '') : '';
      return legacy.replace(/\/api$/, '');
    } catch (error) {
      console.warn('No se pudo leer la configuracion del servidor', error);
      return '';
    }
  })();

  if (storedBase) {
    configureApiBtn.title = `Servidor actual: ${storedBase}`;
  }

  configureApiBtn.addEventListener('click', async () => {
    const currentBase = getBackendURL();
    const input = window.prompt(t('prompt.backendUrl'), currentBase);
    if (input === null) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      try {
        if (hasLocalStorage()) {
          window.localStorage.removeItem(API_STORAGE_KEY);
          window.localStorage.removeItem(STORAGE_KEYS.backendUrl);
        }
        configureApiBtn.classList.remove('footer-link--alert');
        configureApiBtn.removeAttribute('title');
      } catch (error) {
        console.error('No se pudo limpiar la configuracion del servidor', error);
      }
      toast('Servidor eliminado');
      setStatusKey('status.serverReset');
      setTimeout(() => window.location.reload(), 200);
      return;
    }

    const normalized = trimmed.replace(/\/$/, '');
    const backendOnly = normalized.replace(/\/api$/, '');
    const final = `${backendOnly}/api`;

    try {
      if (hasLocalStorage()) {
        window.localStorage.setItem(API_STORAGE_KEY, final);
        window.localStorage.setItem(STORAGE_KEYS.backendUrl, backendOnly);
      }
    } catch (error) {
      console.error('No se pudo guardar la configuracion del servidor', error);
    }

    configureApiBtn.title = `Servidor actual: ${backendOnly}`;
    toast('Servidor guardado');

    try {
      await fetch(`${backendOnly}/save-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backend_url: backendOnly,
          voice_lang: getCurrentLocale(),
        }),
      });
    } catch (error) {
      console.warn('No se pudo sincronizar la configuracion con el backend', error);
    }

    setStatusKey('status.serverUpdated');
    setTimeout(() => window.location.reload(), 200);
  });
  // Also initialize modal controls if present
  initSettingsServerControls();
}

function normalizeBackendBase(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const noSlash = trimmed.replace(/\/$/, '');
  return noSlash.replace(/\/api$/, '');
}

async function saveBackendBase(backendOnly) {
  const finalApi = `${backendOnly}/api`;
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(API_STORAGE_KEY, finalApi);
      window.localStorage.setItem(STORAGE_KEYS.backendUrl, backendOnly);
    }
  } catch (error) {
    console.error('No se pudo guardar la configuracion del servidor', error);
  }
  if (currentServerLabel) {
    currentServerLabel.textContent = t('config.currentServer', { url: backendOnly });
  }
  toast('Servidor guardado');
  try {
    await fetch(`${backendOnly}/save-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend_url: backendOnly, voice_lang: getCurrentLocale() }),
    });
  } catch (error) {
    console.warn('No se pudo sincronizar la configuracion con el backend', error);
  }
  setStatusKey('status.serverUpdated');
  setTimeout(() => window.location.reload(), 200);
}

function resetBackendBase() {
  try {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(API_STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEYS.backendUrl);
    }
  } catch (error) {
    console.error('No se pudo limpiar la configuracion del servidor', error);
  }
  if (settingBackendInput) {
    settingBackendInput.value = getBackendURL();
  }
  if (currentServerLabel) {
    currentServerLabel.textContent = '';
  }
  toast('Servidor eliminado');
  setStatusKey('status.serverReset');
  setTimeout(() => window.location.reload(), 200);
}

function initSettingsServerControls() {
  if (settingBackendInput) {
    settingBackendInput.placeholder = t('prompt.backendUrl');
    settingBackendInput.value = getBackendURL();
  }
  if (currentServerLabel) {
    currentServerLabel.textContent = t('config.currentServer', { url: getBackendURL() });
  }
  if (saveBackendBtn) {
    saveBackendBtn.addEventListener('click', async () => {
      const normalized = normalizeBackendBase(settingBackendInput ? settingBackendInput.value : '');
      if (!normalized) {
        resetBackendBase();
        return;
      }
      await saveBackendBase(normalized);
    });
  }
  if (resetBackendBtn) {
    resetBackendBtn.addEventListener('click', () => {
      resetBackendBase();
    });
  }
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
  const label = isUnavailable ? t('mic.stateUnavailable') : (isListening ? t('mic.stateStop') : t('mic.stateStart'));

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
  log('Accion llamada', number);
  llamar(number).catch((error) => {
    log('Fallo al solicitar la llamada', error);
  });
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
    setStatusKey('status.pressStart');
    setMicState('ready');
    return;
  }

  const SpeechRecognition = RawSpeechRecognition;
  if (!SpeechRecognition) {
    recognition = null;
    setStatusKey('status.srUnsupported');
    setMicState('unavailable');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.addEventListener('result', onSpeechResult);
  recognition.addEventListener('start', () => {
    log('ASR start');
    setStatusKey('status.listening');
    setMicState('listening');
  });
  recognition.addEventListener('end', () => {
    log('ASR end');
    if (recognitionPauseResolver) {
      const resolve = recognitionPauseResolver;
      recognitionPauseResolver = null;
      recognitionPausePromise = null;
      resolve();
    }
    if (!listening) {
      setStatusKey('status.micStopped');
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
    log('ASR error', event);
    setStatusKey('status.micError', { error: event.error || '' });
    stopListening();
    resetAutoAssist({ rearmPassive: true });
  });

  setMicState('ready');
}

function startListening() {
  autoSilenceRetryCount = 0;
  if (USE_SERVER_SR) {
    startServerStt().catch((error) => {
      console.error('No se pudo iniciar la grabacion para STT', error);
      setStatusKey('status.cannotStartRecording');
      setMicState('ready');
      resetAutoAssist({ rearmPassive: true });
    });
    return;
  }
  if (!recognition || listening) {
    if (!recognition) {
      setStatusKey('status.srUnavailable');
    }
    return;
  }
  listening = true;
  lastFinalTranscript = '';
  playBeep(880, 0.12);
  try {
    recognition.start();
    setStatusKey('status.activatingMic');
    setMicState('listening');
  } catch (error) {
    listening = false;
    setStatusKey('status.micInitError', { error: error.message || '' });
    setMicState('ready');
    resetAutoAssist({ rearmPassive: true });
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
    setStatusKey('status.micStopped');
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
  setStatusKey('status.micStopped');
  setMicState('ready');
}

async function startServerStt() {
  if (serverTranscribing || listening) {
    return;
  }
  serverCancelled = false;
  serverChunks = [];
  setMicState('listening');
  setStatusKey('status.preparingMic');

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
  setStatusKey('status.recording');

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
      setStatusKey('status.micStopped');
      setMicState('ready');
      return;
    }

    if (!chunks.length) {
      serverChunks = [];
      serverTranscribing = false;
      setStatusKey('status.noAudio');
      setMicState('ready');
      return;
    }

    handleServerRecordingComplete(chunks, recorderMime).catch((error) => {
      console.error('No se pudo procesar el audio grabado', error);
      setStatusKey('status.transcriptionFailed');
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
    setStatusKey('status.micStopped');
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
  const chunkType = (chunks && chunks[0] && chunks[0].type) || '';
  const blobType = mimeType || chunkType || 'audio/webm';
  const audioBlob = new Blob(chunks, { type: blobType });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'input.webm');

  try {
    setStatusKey('status.transcribing');
    const response = await fetch(STT_URL, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      throw new Error(`stt-${response.status}`);
    }
    const payload = await response.json();
    const transcript = (payload.text || '').trim();

    liveTextEl.textContent = transcript || '\u2014';
    if (!transcript) {
      serverAutoLoop = false;
      autoSilenceRetryCount += 1;
      serverShouldAutoRestart = true;
      if (autoSilenceRetryCount <= MAX_SILENCE_AUTO_RETRIES) {
        await speak(t('voice.repeatPrompt'));
      }
      setStatusKey('status.noUnderstanding');
      return;
    }

    autoSilenceRetryCount = 0;
    checkForCallKeywords(transcript);
    await processUtterance(transcript);
    shouldRestart = serverAutoLoop;
  } finally {
    serverChunks = [];
    serverTranscribing = false;
    const pendingAutoRestart = serverShouldAutoRestart;
    const autoResume = shouldRestart || pendingAutoRestart;
    serverShouldAutoRestart = false;
    if (autoResume) {
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

function detachPassiveAutoAssist() {
  if (typeof document === 'undefined') {
    autoAssistArmed = false;
    autoAssistHandler = null;
    return;
  }
  if (!autoAssistArmed || !autoAssistHandler) {
    autoAssistArmed = false;
    autoAssistHandler = null;
    return;
  }
  PASSIVE_AUTO_EVENTS.forEach((eventName) => {
    document.removeEventListener(eventName, autoAssistHandler);
  });
  autoAssistArmed = false;
  autoAssistHandler = null;
}

function armPassiveAutoAssist() {
  if (autoAssistTriggered || autoAssistArmed) {
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  detachPassiveAutoAssist();
  autoAssistArmed = true;
  autoAssistHandler = () => {
    detachPassiveAutoAssist();
    triggerAutoAssist().catch((error) => {
      console.warn('No se pudo iniciar automaticamente el asistente', error);
    });
  };
  PASSIVE_AUTO_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, autoAssistHandler, { once: true });
  });
}

function resetAutoAssist(options = {}) {
  const { rearmPassive = false } = options;
  autoAssistTriggered = false;
  if (rearmPassive) {
    armPassiveAutoAssist();
    return;
  }
  detachPassiveAutoAssist();
}

async function triggerAutoAssist() {
  if (autoAssistTriggered || listening || serverTranscribing) {
    return;
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    setStatusKey('status.srUnsupported');
    return;
  }
  detachPassiveAutoAssist();
  autoAssistTriggered = true;
  try {
    const started = await beginAssistFlow();
    if (!started) {
      autoAssistTriggered = false;
      armPassiveAutoAssist();
    }
  } catch (error) {
    autoAssistTriggered = false;
    armPassiveAutoAssist();
    throw error;
  }
}

function setupAutoAssist() {
  if (typeof navigator === 'undefined') {
    return;
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    setStatusKey('status.srUnsupported');
    return;
  }

  if (navigator.permissions && typeof navigator.permissions.query === 'function') {
    navigator.permissions.query({ name: 'microphone' }).then((status) => {
      updatePermissionMonitor(status);
      handlePermissionState(status.state);
    }).catch(() => {
      armPassiveAutoAssist();
    });
  } else {
    armPassiveAutoAssist();
  }
}

function updatePermissionMonitor(status) {
  if (!status) {
    return;
  }
  if (permissionMonitor) {
    if (typeof permissionMonitor.removeEventListener === 'function') {
      permissionMonitor.removeEventListener('change', onPermissionChange);
    } else {
      permissionMonitor.onchange = null;
    }
  }
  permissionMonitor = status;
  if (typeof status.addEventListener === 'function') {
    status.addEventListener('change', onPermissionChange);
  } else {
    status.onchange = onPermissionChange;
  }
}

function onPermissionChange(event) {
  const state = (event && event.target && event.target.state) || (permissionMonitor && permissionMonitor.state);
  handlePermissionState(state);
}

function handlePermissionState(state) {
  const idle = !listening && !serverTranscribing;
  if (!state) {
    armPassiveAutoAssist();
    return;
  }
  if (state === 'granted') {
    triggerAutoAssist().catch((error) => {
      console.warn('No se pudo iniciar automaticamente tras permiso concedido', error);
    });
    return;
  }
  if (state === 'prompt') {
    resetAutoAssist({ rearmPassive: true });
    if (idle) {
      setStatusKey('status.audioPermission');
    }
    return;
  }
  if (state === 'denied') {
    resetAutoAssist();
    if (idle) {
      setStatusKey('status.audioPermission');
    }
    return;
  }
}

async function beginAssistFlow(options = {}) {
  const { fromUser = false } = options;
  if (USE_BROWSER_SR && !recognition) {
    initSpeech();
  }
  try {
    await initAudioGesture();
  } catch (error) {
    console.warn('No se pudo preparar el audio', error);
  }

  try {
    await ensureMicPermission();
  } catch (error) {
    if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      setStatusKey('status.audioPermission');
    } else if (error && error.name === 'NotFoundError') {
      setStatusKey('status.micError', { error: 'No disponible' });
    } else {
      setStatusKey('status.cannotStartRecording');
    }
    if (fromUser) {
      throw error;
    }
    return false;
  }

  try {
    await speak(t('voice.initialPrompt'));
  } catch (error) {
    console.warn('No se pudo reproducir el mensaje inicial', error);
  }

  setStatusKey(USE_SERVER_SR ? 'status.preparingMic' : 'status.activatingMic');
  startListening();
  return listening || serverTranscribing;
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
    liveTextEl.textContent = interimTranscript;
  }

  const cleanedFinal = finalTranscript.trim();
  if (!cleanedFinal || cleanedFinal === lastFinalTranscript) {
    return;
  }

  lastFinalTranscript = cleanedFinal;
  liveTextEl.textContent = cleanedFinal;
  log('ASR text:', cleanedFinal);
  manejarComandoVoz(cleanedFinal);
  checkForCallKeywords(cleanedFinal);
  processUtterance(cleanedFinal).catch((error) => {
    log('ASR process error', error);
  });
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
  setStatusKey('status.processingInstruction');

  try {
    const guideResponse = await fetch(GUIDE_URL, {
      method: 'POST',
      signal: (pendingController ? pendingController.signal : undefined),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: text,
        lang: getCurrentLocale(),
        session_id: sessionId
      })
    });

    if (!guideResponse.ok) {
      const payload = await guideResponse.json().catch(() => ({}));
      throw new Error(payload.error || t('error.nextInstruction'));
    }

    const guideData = await guideResponse.json();
    const stepIndex = typeof guideData.step === 'number' ? guideData.step - 1 : null;
    const stepText = guideData.text || guideData.say || t('status.noMoreInstructions');
    const speechText = guideData.say || guideData.text || stepText;
    const shouldContinue = Boolean(guideData.next);
    serverAutoLoop = shouldContinue;
    if (USE_SERVER_SR) {
      serverShouldAutoRestart = !shouldContinue;
    }

    await pauseRecognitionForSpeech();
    renderGuideStep({
      step: typeof stepIndex === 'number' ? stepIndex + 1 : null,
      text: stepText,
      title: guideData.title,
      totalSteps: guideData.total_steps || guideData.totalSteps
    });

    if (USE_BROWSER_SR) {
      recognitionShouldResume = true;
    }

    if (speechText) {
      await speak(speechText);
    }

    if (shouldContinue) {
      setStatusKey('status.instructionReady');
    } else {
      setStatusKey('status.protocolCompleted');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    serverAutoLoop = false;
    setStatusKey('status.errorWithMessage', { message: error.message });
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

// Force backend TTS (disables Web Speech API to avoid silent playback)
const FORCE_BACKEND_TTS = true;

async function speak(text) {
  const tryWebSpeech = async () => {
    if (!('speechSynthesis' in window)) {
      return false;
    }
    const ok = await ensureSpeechReady().catch(() => false);
    if (!ok) {
      return false;
    }
    stopSpeaking();
    log('TTS speak (web):', text);
    activeUtterance = new SpeechSynthesisUtterance(text);
    const targetLocale = getCurrentLocale();
    activeUtterance.lang = targetLocale;
    activeUtterance.pitch = 1;
    activeUtterance.rate = 1;
    activeUtterance.volume = 1;
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices && voices.length) {
      const lowerLang = (value) => (value || '').toLowerCase();
      const targetLower = (targetLocale || '').toLowerCase();
      const baseLang = targetLower.split('-')[0] || targetLower;
      const exact = voices.find((voice) => lowerLang(voice.lang) === targetLower);
      const localeMatch = voices.find((voice) => lowerLang(voice.lang).startsWith(baseLang));
      const contains = voices.find((voice) => lowerLang(voice.lang).includes(baseLang));
      activeUtterance.voice = exact || localeMatch || contains || voices[0];
    }
    return new Promise((resolve) => {
      let resolved = false;
      const settle = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(true);
      };
      activeUtterance.onstart = () => {
        log('TTS start');
        settle();
      };
      activeUtterance.onend = () => {
        log('TTS end');
        handleSpeechFinished();
        settle();
      };
      activeUtterance.onerror = (event) => {
        log('TTS error', event);
        console.error('Error reproduciendo la instruccion', event.error || event);
        setStatusKey('status.speechFailed');
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
        setStatusKey('status.speechFailed');
        handleSpeechFinished();
        settle();
      }
    });
  };

  // Backend TTS fallback (iOS Safari, or when Web Speech not available)
  const tryBackendTts = async () => {
    if (!ttsPlayer) {
      return false;
    }
    try {
      const base = getBackendURL().replace(/\/$/, '');
      const url = `${base}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(getCurrentLocale())}`;
      return await new Promise((resolve) => {
        const cleanup = () => {
          ttsPlayer.onended = null;
          ttsPlayer.onerror = null;
          ttsPlayer.oncanplay = null;
        };
        ttsPlayer.onended = () => {
          log('TTS backend end');
          handleSpeechFinished();
          cleanup();
          resolve(true);
        };
        ttsPlayer.onerror = (e) => {
          console.warn('TTS backend error', e);
          setStatusKey('status.speechFailed');
          handleSpeechFinished();
          cleanup();
          resolve(false);
        };
        ttsPlayer.oncanplay = async () => {
          try {
            await ttsPlayer.play();
          } catch (error) {
            console.warn('No se pudo reproducir el TTS backend', error);
            setStatusKey('status.speechFailed');
            cleanup();
            resolve(false);
          }
        };
        // iOS/Safari requires gesture-unlocked audio; ensure context resumed earlier
        ttsPlayer.src = url;
        // Resolve after a small delay to not block flow even if playback is slow
        window.setTimeout(() => resolve(true), 180);
      });
    } catch (error) {
      console.warn('Fallo en TTS backend', error);
      return false;
    }
  };

  // Pause recognition during speech
  await pauseRecognitionForSpeech();
  // If forcing backend TTS, skip Web Speech entirely
  const usedWeb = FORCE_BACKEND_TTS ? false : await tryWebSpeech();
  if (usedWeb) return;
  await tryBackendTts();
}

function stopSpeaking() {
  if (!('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  activeUtterance = null;
}

function setStatusMessage(message) {
  lastStatusKey = null;
  lastStatusParams = null;
  statusEl.textContent = message;
}

function setStatusKey(key, params = {}) {
  lastStatusKey = key;
  lastStatusParams = params;
  statusEl.textContent = t(key, params);
}

function refreshStatus() {
  if (!statusEl || !lastStatusKey) return;
  statusEl.textContent = t(lastStatusKey, lastStatusParams || {});
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
  const keywords = getCallKeywords();
  if (keywords.some((keyword) => normalized.includes(keyword))) {
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
    setStatusKey('status.systemReady');
    if (configureApiBtn) { configureApiBtn.classList.remove('footer-link--alert'); }
  } catch (error) {
    console.error('No se pudo verificar la API', error);
    setStatusKey('status.apiUnavailable');
    if (configureApiBtn) { configureApiBtn.classList.add('footer-link--alert'); }
  }

}

window.addEventListener('DOMContentLoaded', () => {
  var el;
  el = byId('btnAjustes'); if (el) el.addEventListener('click', abrirAjustes);
  el = byId('btnManual'); if (el) el.addEventListener('click', abrirManual);
  el = byId('btnConfigServidor'); if (el) el.addEventListener('click', configurarServidor);
  el = byId('btnLlamada112'); if (el) el.addEventListener('click', function(){ llamar(EMERGENCY_NUMBER); });
  el = byId('btnLlamadaTest'); if (el) el.addEventListener('click', function(){ llamar(TEST_NUMBER); });
  el = byId('btnIniciarVoz'); if (el) el.addEventListener('click', iniciarVoz);
});

function byId(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function log(...args) {
  try {
    console.log('[ConRumbo]', ...args);
  } catch (error) {
    // silencio en entornos sin consola
  }
}

function toast(message) {
  if (!message) {
    return;
  }
  log('Toast:', message);
  if (typeof setStatusMessage === 'function') {
    setStatusMessage(message);
    window.setTimeout(() => {
      if (lastStatusKey) {
        refreshStatus();
      }
    }, 2000);
  } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  }
}

function getBackendURL() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000';
  }
  try {
    const stored = hasLocalStorage() ? window.localStorage.getItem(STORAGE_KEYS.backendUrl) : null;
    if (stored) {
      return stored;
    }
  } catch (error) {
    log('No se pudo leer backend_url', error);
  }
  if (API_BASE && API_BASE.endsWith('/api')) {
    return API_BASE.slice(0, -4);
  }
  return API_BASE || 'http://127.0.0.1:8000';
}

async function configurarServidor() {
  const promptValue = window.prompt('URL del backend (e.g. http://127.0.0.1:8000):', getBackendURL());
  if (promptValue === null) {
    return;
  }
  const trimmed = promptValue.trim();
  if (!trimmed) {
    toast('Servidor eliminado');
    try {
      if (hasLocalStorage()) {
        window.localStorage.removeItem(API_STORAGE_KEY);
        window.localStorage.removeItem(STORAGE_KEYS.backendUrl);
      }
    } catch (error) {
      log('No se pudo limpiar backend_url', error);
    }
    if (configureApiBtn) {
      configureApiBtn.classList.remove('footer-link--alert');
      configureApiBtn.removeAttribute('title');
    }
    setTimeout(() => window.location.reload(), 200);
    return;
  }
  const backendOnly = trimmed.replace(/\/$/, '').replace(/\/api$/, '');
  const apiBase = `${backendOnly}/api`;
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEYS.backendUrl, backendOnly);
      window.localStorage.setItem(API_STORAGE_KEY, apiBase);
    }
  } catch (error) {
    log('No se pudo guardar backend_url', error);
  }
  if (configureApiBtn) {
    configureApiBtn.classList.remove('footer-link--alert');
    configureApiBtn.title = `Servidor actual: ${backendOnly}`;
  }
  toast('Servidor guardado');
  try {
    await fetch(`${backendOnly}/save-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend_url: backendOnly, voice_lang: getCurrentLocale() }),
    });
  } catch (error) {
    log('No se pudo sincronizar la configuracion', error);
  }
  setTimeout(() => window.location.reload(), 200);
}

async function llamar(numero) {
  const backend = getBackendURL().replace(/\/$/, '');
  const endpoint = `${backend}/call`;
  log('Llamada solicitada', numero, '->', endpoint);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: numero }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    toast('Llamada enviada');
    return await response.json();
  } catch (error) {
    log('Error al llamar', error);
    toast('Error al llamar');
    throw error;
  }
}

function mostrarPanel(nombre) {
  const target = (nombre || '').toLowerCase();
  log('Mostrar panel solicitado', target);
  if (target === 'ajustes') {
    if (settingThemeSelect) {
      settingThemeSelect.value = themePreference;
    }
    if (settingLanguageSelect) {
      settingLanguageSelect.value = currentLanguage;
    }
    showSettingsModal();
    return;
  }
  if (target === 'manual') {
    if (settingThemeSelect) {
      settingThemeSelect.value = themePreference;
    }
    if (settingLanguageSelect) {
      settingLanguageSelect.value = currentLanguage;
    }
    showManualModal();
    return;
  }
  log('Panel desconocido', nombre);
}

function abrirAjustes() {
  log('Abrir ajustes');
  mostrarPanel('ajustes');
}

function abrirManual() {
  log('Abrir manual');
  mostrarPanel('manual');
}

function crearRecognition() {
  if (!USE_BROWSER_SR) {
    toast('Reconocimiento de voz no soportado');
    return null;
  }
  if (!recognition) {
    initSpeech();
  }
  if (!recognition) {
    toast('Reconocimiento de voz no soportado');
    return null;
  }
  recognition.lang = 'es-ES';
  return recognition;
}

async function iniciarVoz() {
  log('Iniciar voz accionado');
  const rec = crearRecognition();
  if (!rec) {
    return;
  }
  try {
    const started = await beginAssistFlow({ fromUser: true });
    if (!started && !listening && !serverTranscribing) {
      try {
        rec.start();
      } catch (error) {
        log('ASR start err', error);
      }
    }
  } catch (error) {
    log('ASR start err', error);
    toast('Error de microfono');
    return;
  }
  speak('Iniciando guia. Paso 1: comprobar seguridad de la escena.').catch((error) => {
    log('TTS inicio err', error);
  });
}

function manejarComandoVoz(texto) {
  if (!texto) {
    return;
  }
  if (/siguiente/i.test(texto)) {
    log('Comando voz: siguiente');
    speak('Paso siguiente.').catch((error) => log('TTS cmd err', error));
  } else if (/repetir/i.test(texto)) {
    log('Comando voz: repetir');
    speak('Repito el ultimo paso.').catch((error) => log('TTS cmd err', error));
  } else {
    log('Comando voz libre:', texto);
    speak(`He entendido: ${texto}`).catch((error) => log('TTS cmd err', error));
  }
}
