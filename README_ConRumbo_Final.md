# 🚑 ConRumbo – Asistente Inteligente de Primeros Auxilios

![ConRumbo Preview](frontend/assets/MVP%20HTML%20Conrumbo.jpg)

> “Mantén la calma. Te guiaré paso a paso.”

**ConRumbo** es una aplicación educativa y de emergencia que combina **IA, reconocimiento visual** y **asistencia guiada por voz** para ofrecer ayuda inmediata en situaciones críticas.  
Diseñada especialmente para **universitarios y jóvenes adultos**, busca enseñar y asistir en primeros auxilios de forma accesible, empática y tecnológica.

---

## 🧠 Objetivo del Proyecto

Este proyecto forma parte del **Trabajo Fin de Máster en Data Science & IA (Evolve Máster)**.  
Su propósito es crear una **plataforma inteligente capaz de asistir y educar en emergencias cotidianas**, aplicando modelos de IA, análisis de datos y diseño emocionalmente inteligente.

El sistema ofrece:
- Reconocimiento visual con la cámara  
- Análisis de signos vitales  
- Guía por voz paso a paso  
- Llamada directa al 112  
- Registro de métricas de uso  

---

## 🌐 Vista Principal de la App

La interfaz central muestra un entorno calmado y claro, con:
- Mensaje principal: *“Mantén la calma. Te guiaré paso a paso.”*  
- Botón de micrófono → activa el **ConRumbo Bot**  
- Panel de transcripción en vivo  
- Monitor de signos vitales (bpm y rpm)  
- Indicador de estado del **scanner 3D**  
- Botón rojo para **llamar al 112**  
- Sección de **instrucciones recientes**

---

## 🧩 Estructura del Proyecto

```
ConRumbo MVP/
│
├── backend/
│   ├── app.py                # Servidor Flask principal (API)
│   ├── emergency_bot.py      # Lógica del asistente de voz y flujo de conversación
│   ├── metrics.py            # Módulo de análisis de métricas (bpm, rpm)
│   ├── metrics_log.csv       # Registro de métricas generadas por los usuarios
│   ├── nlp_processor.py      # Procesamiento de lenguaje natural (instrucciones y respuestas)
│   └── protocols.json        # Protocolos de primeros auxilios estructurados por tipo de emergencia
│
├── frontend/
│   ├── index.html            # Interfaz principal (UI)
│   ├── style.css             # Estilos visuales (colores, estructura, tipografía)
│   ├── script.js             # Lógica del cliente: micrófono, cámara, eventos
│   ├── sw.js                 # Service Worker para funcionamiento offline (PWA)
│   ├── manifest.webmanifest  # Configuración para instalación móvil (Progressive Web App)
│   └── assets/
│       ├── lens-photo.jpg                # Imagen decorativa / recurso visual
│       └── MVP HTML Conrumbo.jpg         # Mockup visual del MVP
│
├── requirements.txt          # Dependencias de Python
├── README_ConRumbo.md        # Documentación del proyecto
└── .gitignore                # Archivos y carpetas ignoradas por Git
```

---

## ⚙️ Instalación y Ejecución

### 🔹 1. Clonar el repositorio
```bash
git clone https://github.com/valentinabailoncano-code/ConRumbo.git
cd "ConRumbo MVP"
```

### 🔹 2. Crear y activar entorno virtual
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
```

### 🔹 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 🔹 4. Ejecutar el servidor backend
```bash
python app.py
```
> Servidor disponible en `http://127.0.0.1:8000`

### 🔹 5. Iniciar el frontend
En una nueva terminal:
```bash
cd ../frontend
python -m http.server 3000
```
> Accede desde el navegador a `http://localhost:3000/index.html`

> 📱 Si quieres probarlo en el móvil:  
> conecta ambos dispositivos a la misma red Wi-Fi y abre la IP local del ordenador (por ejemplo, `http://192.168.1.10:3000`).

---

## 🤖 Funcionalidades Principales

| Función | Descripción |
|----------|-------------|
| 🎙️ **ConRumbo Bot** | Asistente de voz con reconocimiento y transcripción en vivo. |
| 🧠 **Procesamiento NLP** | Interpreta las respuestas del usuario y ofrece instrucciones guiadas. |
| 💓 **Módulo de métricas** | Calcula bpm y rpm, guardando el registro en `metrics_log.csv`. |
| 📋 **Protocolos JSON** | Contiene guías estructuradas de primeros auxilios según la emergencia. |
| 🧍‍♀️ **Reconocimiento visual** | Permite escanear heridas o situaciones mediante cámara. |
| ☎️ **Botón 112** | Llamada de emergencia simulada o real. |
| 🌐 **PWA (Progressive Web App)** | Permite instalar la app en el móvil y usarla offline. |

---

## 🧬 IA y Data Science

El backend integra componentes de IA y análisis de datos:

- **Speech Recognition:** `speech_recognition`, `gTTS`  
- **Procesamiento NLP:** `transformers`, `scikit-learn`  
- **Análisis visual:** `OpenCV`, `MediaPipe`  
- **Backend:** `Flask`, `Flask-CORS`  
- **Frontend:** `HTML`, `CSS`, `JavaScript`  

Aplicaciones:
- Detección del tipo de emergencia por voz.  
- Generación automática de instrucciones adaptadas.  
- Detección visual de heridas (scanner activo).  
- Análisis de métricas para alertas automáticas.

---

## 📱 Público Objetivo

- Estudiantes universitarios  
- Jóvenes adultos  
- Centros educativos o empresas con programas de formación  
- Usuarios que buscan una guía simple y rápida ante emergencias  

---

## 💡 Futuras Mejoras

- 📍 Geolocalización y envío de coordenadas al 112  
- 🧩 Personalización por nivel de experiencia  
- 🗣️ Asistente empático con tono adaptativo  
- 📦 ConRumbo Kits (integración con kits físicos de emergencia)  
- 📊 Panel de estadísticas de emergencias en tiempo real  

---

## 👩‍💻 Autora

**Valentina Bailon Cano**  
📍 Universidad Pontificia Comillas – ICADE  
🎓 Máster en Data Science & IA – Evolve Máster  
🌐 [LinkedIn](https://www.linkedin.com/in/valentinabailoncano/)

---

## 📜 Licencia

Este proyecto está bajo la licencia **MIT**.  
Puedes usarlo, modificarlo y distribuirlo citando la fuente.

---

### 🩹 ConRumbo — La calma es el primer paso para salvar una vida.
