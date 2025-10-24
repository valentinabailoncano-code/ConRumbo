# ConRumbo MVP – Quickstart

## Backend (Flask)
- Requisitos: Python 3.10+, dependencias de `requirements.txt` (`pip install -r requirements.txt`).
- Arranque: `python backend/app.py` desde la raiz del proyecto.
- El servicio expone `http://127.0.0.1:8000` (y `0.0.0.0:8000`). En consola veras `Flask listo en :8000` cuando el servidor este disponible.
- Endpoints clave:
  - `GET /health` → `{ "status": "ok" }`
  - `GET /api/health` → `{ "ok": true }`
  - `POST /call` → `{ "to": "<numero>" }` → `{ "ok": true, "mode": "<mock|twilio>" }`
  - `POST /save-config` → `{ "backend_url": "...", "voice_lang": "es-ES" }` → `{ "ok": true, ... }`
  - `POST /api/stt` → recibe `audio/*` (WEBM/OGG/WAV), normaliza a WAV 16k mono y devuelve `{ "text": "..." }`
  - `POST /api/guide` → `{ query, lang, session_id }` → guía paso a paso
  - `POST /api/assistant` → alias de `/api/guide` para compatibilidad
  - `GET /api/tts?text=...&lang=es-ES` → genera `audio/mpeg` (usa gTTS si está disponible)
  - CORS habilitado para `http://localhost:*` y redes LAN comunes
- CORS habilitado para `http://localhost:*` y redes LAN comunes.

## Frontend (estático)
- Servir la carpeta `frontend/` con cualquier servidor estatico. Ejemplo:
  ```
  cd frontend
  python -m http.server 3000
  ```
- Abre `http://localhost:3000` (o el puerto elegido) en el navegador.
- En la consola del navegador se registran los eventos funcionales: tiempo de arranque, clicks de botones, ASR/TTS, etc.

También puedes usar los scripts de desarrollo desde la raíz del proyecto:

Windows:
```
start_dev.bat
```

macOS/Linux:
```
chmod +x start_dev.sh
./start_dev.sh
```

## Configuración de backend
- Abre Ajustes → sección “Servidor”.
- Introduce la URL base del backend, por ejemplo `http://192.168.1.41:8000` y pulsa Guardar.
- Se guarda en `localStorage` (`backend_url`) y también en `conrumbo.apiBase`.
- El front envía la configuración al backend vía `POST /save-config` para sincronizar `backend_url` y `voice_lang`.

## Voz y micrófono (Desktop y Móvil)
- STT (Transcripción):
  - Si el navegador soporta Web Speech API y el dispositivo es compatible → se usa reconocimiento del navegador.
  - En iOS Safari y navegadores sin soporte → se graba con `MediaRecorder` (1–3 s) y se envía a `/api/stt`.
- Asistente:
  - Cada frase reconocida se envía a `/api/guide` (o `/api/assistant`) para obtener el siguiente paso.
- TTS (Síntesis):
  - Preferencia `speechSynthesis` del navegador.
  - Fallback: `GET /api/tts` que devuelve `audio/mpeg`, reproducido con `<audio id="ttsPlayer" playsinline muted>` desbloqueado por el gesto inicial.
- Requisitos móviles:
  - Se necesita un gesto del usuario (clic en Iniciar) para habilitar audio y permisos.
  - iOS Safari restringe `SpeechRecognition` y `autoplay`; por eso existe el fallback a backend TTS y STT en `/api/stt`.

## Logs y diagnostico
- **Backend**: consola imprime `Flask listo en :8000`, peticiones de `/call`, sincronizacion de configuracion y cualquier error del mock/carrier.
- **Frontend** (con prefijo `[ConRumbo]`):
  - `Tiempo de arranque (ms): <valor>` tras el evento `load`.
  - Acciones de botones (`Abrir manual`, `Abrir ajustes`, `Llamada solicitada`, etc.).
  - Eventos de reconocimiento (`ASR start/end/error`, `ASR text: ...`) y comandos de voz interpretados.
  - Eventos de voz (`TTS speak/start/end/error`).
- En caso de error de llamada se muestra un toast (`Error al llamar`) y un log con la excepcion original.

## Pruebas rápidas
1. `GET http://127.0.0.1:8000/health` → 200 `{ "status": "ok" }`.
2. `POST http://127.0.0.1:8000/call` con `{ "to": "112" }` → 200 `{ "ok": true, ... }`.
3. En la UI: probar botones `Manual`, `Ajustes`, `Configurar servidor`, `Llamada TEST`, `Llamar 112`, `Iniciar Voz`.
4. Confirmar mensaje `Tiempo de arranque (ms)` < 10000 en consola.
5. Enviar comando de voz "siguiente" tras pulsar `Iniciar Voz` → escuchar respuesta TTS y ver logs `ASR text` / `Comando voz`.

## Limitaciones conocidas
- `/api/stt` usa `speech_recognition` (Google) por defecto; requiere conexión a Internet. Para funcionamiento 100% offline, sustituir por Whisper (faster-whisper) y ffmpeg.
- `GET /api/tts` usa gTTS si está instalado; también requiere Internet. Puedes integrar pyttsx3 u otro motor si necesitas offline.
- iOS Safari puede cancelar reproducciones si no hay un gesto de usuario; el botón Iniciar ya realiza el “unlock” de audio.
