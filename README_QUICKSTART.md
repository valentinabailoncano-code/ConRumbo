# ConRumbo MVP – Quickstart

## Backend (Flask)
- Requisitos: Python 3.10+, dependencias de `requirements.txt` (`pip install -r requirements.txt`).
- Arranque: `python backend/app.py` desde la raiz del proyecto.
- El servicio expone `http://127.0.0.1:8000` (y `0.0.0.0:8000`). En consola veras `Flask listo en :8000` cuando el servidor este disponible.
- Endpoints clave:
  - `GET /health` → `{ "status": "ok" }`
  - `POST /call` → cuerpo `{ "to": "<numero>" }`, responde `{ "ok": true, "mode": "<mock|twilio>" }`
  - `POST /save-config` → cuerpo `{ "backend_url": "...", "voice_lang": "es-ES" }`, responde `{ "ok": true, ... }`
  - Rutas existentes bajo `/api/...` siguen operativas para el front actual.
- CORS habilitado para `http://localhost:*` y redes LAN comunes.

## Frontend (estatico)
- Servir la carpeta `frontend/` con cualquier servidor estatico. Ejemplo:
  ```
  cd frontend
  python -m http.server 3000
  ```
- Abre `http://localhost:3000` (o el puerto elegido) en el navegador.
- En la consola del navegador se registran los eventos funcionales: tiempo de arranque, clicks de botones, ASR/TTS, etc.

## Configuracion de backend
- Boton `Configurar servidor` en el pie del dashboard (o cualquier elemento con id `btnConfigServidor`) abre un prompt para guardar la URL del backend.
- El valor se guarda en `localStorage` (`backend_url`) y tambien en el almacenamiento legado (`conrumbo.apiBase`), por lo que persiste entre sesiones.
- El front envia la configuracion al backend via `POST /save-config` para mantener sincronizados `backend_url` y `voice_lang`.

## Voz y microfono (Desktop y Movil)
- Reconocimiento: se usa la API nativa (`SpeechRecognition/webkitSpeechRecognition`) en español (`es-ES`).
- Sintesis: `speechSynthesis` encolada; cada inicio de voz reproduce `Iniciando guia...` y marca logs `TTS start/end/error`.
- Requisitos moviles:
  - Servir la aplicacion bajo HTTPS o desde una LAN de confianza.
  - Es necesaria una interaccion del usuario (ej. click en `Iniciar Voz`) antes del primer `speechSynthesis.speak`.
  - El navegador solicitara permiso de microfono la primera vez que se invoque `recognition.start()`.

## Logs y diagnostico
- **Backend**: consola imprime `Flask listo en :8000`, peticiones de `/call`, sincronizacion de configuracion y cualquier error del mock/carrier.
- **Frontend** (con prefijo `[ConRumbo]`):
  - `Tiempo de arranque (ms): <valor>` tras el evento `load`.
  - Acciones de botones (`Abrir manual`, `Abrir ajustes`, `Llamada solicitada`, etc.).
  - Eventos de reconocimiento (`ASR start/end/error`, `ASR text: ...`) y comandos de voz interpretados.
  - Eventos de voz (`TTS speak/start/end/error`).
- En caso de error de llamada se muestra un toast (`Error al llamar`) y un log con la excepcion original.

## Pruebas rapidas
1. `GET http://127.0.0.1:8000/health` → 200 `{ "status": "ok" }`.
2. `POST http://127.0.0.1:8000/call` con `{ "to": "112" }` → 200 `{ "ok": true, ... }`.
3. En la UI: probar botones `Manual`, `Ajustes`, `Configurar servidor`, `Llamada TEST`, `Llamar 112`, `Iniciar Voz`.
4. Confirmar mensaje `Tiempo de arranque (ms)` < 10000 en consola.
5. Enviar comando de voz "siguiente" tras pulsar `Iniciar Voz` → escuchar respuesta TTS y ver logs `ASR text` / `Comando voz`.
