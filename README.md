# 🚑 ConRumbo – Asistente Inteligente de Primeros Auxilios

> “Mantén la calma. Te guiaré paso a paso.”

**ConRumbo** es una aplicación educativa y de emergencia que combina **IA, reconocimiento visual** y **asistencia guiada por voz** para ofrecer ayuda inmediata en situaciones críticas.  
Diseñada especialmente para **universitarios y jóvenes adultos**, busca enseñar y asistir en primeros auxilios de forma accesible, empática y tecnológica.

---

## 🧠 Objetivo del Proyecto

Este proyecto forma parte del **Trabajo Fin de Máster en Data Science & IA (Evolve Máster)**.  
Su propósito es crear una **plataforma inteligente capaz de asistir y educar en emergencias cotidianas**, aplicando modelos de IA, análisis de datos y diseño emocionalmente inteligente.

El sistema ofrece:

- 📷 Reconocimiento visual con la cámara  
- 💓 Análisis de signos vitales  
- 🗣️ Guía por voz paso a paso  
- ☎️ Llamada directa al 112  
- 📊 Registro de métricas de uso  

---

## 🌐 Vista Principal de la App

La interfaz central muestra un entorno **calmado y claro**, con:

- Mensaje principal: *“Mantén la calma. Te guiaré paso a paso.”*  
- Botón de micrófono → activa el **ConRumbo Bot**  
- Panel de **transcripción en vivo**  
- **Monitor de signos vitales** (bpm y rpm)  
- Indicador del **scanner 3D**  
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
│   └── protocols.json        # Protocolos de primeros auxilios por tipo de emergencia
│
├── frontend/
│   ├── index.html            # Interfaz principal (UI)
│   ├── style.css             # Estilos visuales (colores, estructura, tipografía)
│   ├── script.js             # Lógica del cliente: micrófono, cámara, eventos
│   ├── sw.js                 # Service Worker para modo offline (PWA)
│   ├── manifest.webmanifest  # Configuración para instalación móvil (Progressive Web App)
│   └── assets/
│       ├── lens-photo.jpg
│       └── MVP HTML Conrumbo.jpg
│
├── requirements.txt          # Dependencias del proyecto
├── README_ConRumbo.md        # Documentación del proyecto
└── .gitignore                # Archivos ignorados por Git
```

---

## ⚙️ Instalación y Ejecución

### 1️⃣ Clonar el repositorio
```bash
git clone https://github.com/valentinabailoncano-code/ConRumbo.git
cd "ConRumbo MVP"
```

### 2️⃣ Crear y activar entorno virtual
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
```

### 3️⃣ Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4️⃣ Ejecutar el servidor backend
```bash
python app.py
```
> Servidor disponible en `http://127.0.0.1:8000`

### 5️⃣ Iniciar el frontend
En una nueva terminal:
```bash
cd ../frontend
python -m http.server 3000
```
> Accede desde el navegador a `http://localhost:3000/index.html`

📱 **Para probarlo en móvil:**  
Asegúrate de que ordenador y móvil estén conectados a la misma red Wi-Fi, y abre en el móvil la IP local del ordenador (por ejemplo `http://192.168.1.41:3000`).

---

## 🤖 Funcionalidades Principales

| Función | Descripción |
|----------|-------------|
| 🎙️ **ConRumbo Bot** | Asistente de voz con reconocimiento y transcripción en vivo |
| 🧠 **Procesamiento NLP** | Interpreta las respuestas del usuario y guía el flujo de actuación |
| 💓 **Módulo de métricas** | Calcula bpm y rpm, registrándolos en `metrics_log.csv` |
| 📋 **Protocolos JSON** | Guías estructuradas por tipo de emergencia |
| 🧍‍♀️ **Reconocimiento visual** | Escaneo de heridas o entorno mediante cámara |
| ☎️ **Botón 112** | Simula o ejecuta la llamada de emergencia |
| 🌐 **PWA (Progressive Web App)** | Instalación en móvil y uso offline |

---

## 🧬 Inteligencia Artificial y Data Science

El backend integra componentes de IA y análisis de datos con las siguientes tecnologías:

| Área | Librerías / Tecnologías | Aplicación |
|------|---------------------------|-------------|
| 🔊 **Reconocimiento de voz** | `speech_recognition`, `gTTS` | Captura y respuesta por voz |
| 🧠 **Procesamiento NLP** | `transformers`, `scikit-learn` | Interpretación de comandos e instrucciones |
| 👁️ **Reconocimiento visual** | `OpenCV`, `MediaPipe` | Detección de heridas o situaciones visuales |
| ⚙️ **Backend API** | `Flask`, `Flask-CORS` | Comunicación entre frontend y lógica IA |
| 💻 **Frontend** | `HTML`, `CSS`, `JavaScript` | Interfaz interactiva con micrófono, cámara y PWA |

---

## 📊 Aplicaciones de IA en el MVP

- Detección automática del tipo de emergencia por voz  
- Generación de instrucciones adaptadas a la situación  
- Análisis visual para identificar heridas o caídas  
- Monitorización de signos vitales con alertas automáticas  
- Registro y análisis de métricas de uso para mejora continua  

---

## 🎯 Público Objetivo

- Estudiantes universitarios  
- Jóvenes adultos que viven solos  
- Centros educativos y empresas con programas de formación  
- Cualquier persona que busque una guía simple y rápida ante emergencias  

---

## 🚀 Futuras Mejoras

- 📍 Geolocalización y envío de coordenadas al 112  
- 👤 Personalización por nivel de experiencia  
- 🗣️ Asistente empático con tono emocional adaptativo  
- 🧰 ConRumbo Kits (integración con kits físicos de emergencia)  
- 📊 Dashboard con estadísticas de uso y emergencias en tiempo real  
- 🔐 Registro de usuario y módulo de aprendizaje progresivo  

---

## 👩‍💻 Autora

**Valentina Bailon Cano**  
📍 Universidad Pontificia Comillas – ICADE  
🎓 Máster en Data Science & IA – Evolve Máster  
🌐 [LinkedIn](https://www.linkedin.com/in/valentinabailoncano/)

---

## 📜 Licencia

Este proyecto está bajo la licencia **MIT**.  
Puedes usarlo, modificarlo y distribuirlo libremente citando la fuente.

---

### 🩹 *ConRumbo — La calma es el primer paso para salvar una vida.*
