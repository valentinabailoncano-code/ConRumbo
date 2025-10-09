# 🚑 ConRumbo – Asistente Inteligente de Primeros Auxilios

> “Mantén la calma. Te guiaré paso a paso.”

**ConRumbo** es una aplicación educativa y de emergencia que combina **IA, reconocimiento visual** y **asistencia guiada** para ofrecer ayuda inmediata en situaciones críticas. Diseñada especialmente para **universitarios y jóvenes adultos**, su objetivo es enseñar y asistir en primeros auxilios de manera accesible, empática y tecnológica.

---

## 🧠 Objetivo del Proyecto

El proyecto nace del Trabajo Fin de Máster en *Data Science & IA (Evolve Máster)*, con el propósito de desarrollar una **plataforma inteligente que reaccione ante emergencias cotidianas** mediante:
- **Reconocimiento visual con la cámara**
- **Análisis de signos vitales**
- **Guía por voz paso a paso**
- **Simulación de llamadas y protocolos automáticos**

El enfoque combina **Data Science**, **IA aplicada al bienestar**, y un **diseño emocionalmente inteligente**.

---

## 🌐 Vista Principal

La interfaz principal refleja un entorno de calma y control:

- **Mensaje central:** “Mantén la calma. Te guiaré paso a paso.”
- **Botón de micrófono:** activa el asistente de voz (`ConRumbo Bot`)
- **Panel de transcripción:** muestra la conversación en vivo
- **Monitor vital:** frecuencia cardíaca (bpm) y respiratoria (rpm)
- **Scanner 3D:** detección visual de heridas o anomalías
- **Botón de emergencia:** llamada directa al **112**
- **Historial de instrucciones recientes**

---

## 🧩 Estructura del Proyecto

```
ConRumbo MVP/
│
├── backend/
│   ├── app.py                # Servidor Flask principal
│   ├── routes/
│   │   ├── voice.py          # Procesamiento del audio
│   │   ├── scanner.py        # Lógica de reconocimiento visual
│   │   └── instructions.py   # Generación de pasos de primeros auxilios
│   ├── models/
│   │   └── ai_model.py       # Modelo IA para reconocimiento de heridas
│   └── static/
│       └── data/             # Imágenes o datasets auxiliares
│
├── frontend/
│   ├── index.html            # Interfaz principal (UI)
│   ├── style.css             # Estilos (colores, tipografía y estructura)
│   ├── script.js             # Lógica del cliente (voz, cámara, eventos)
│   └── assets/               # Iconos, imágenes y sonidos
│
├── .env                      # Variables de entorno (tokens, API keys)
├── requirements.txt           # Dependencias Python
├── README.md                 # Documentación del proyecto
└── LICENSE
```

---

## ⚙️ Instalación y Ejecución

### 🔸 1. Clonar el repositorio
```bash
git clone https://github.com/valentinabailoncano-code/ConRumbo.git
cd ConRumbo\backend
```

### 🔸 2. Crear y activar entorno virtual
```bash
python -m venv .venv
.venv\Scripts\activate
```

### 🔸 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 🔸 4. Ejecutar el backend
```bash
python app.py
```
> El servidor se iniciará en `http://127.0.0.1:8000`

### 🔸 5. Levantar el frontend
```bash
cd ../frontend
python -m http.server 3000
```
> Abre el navegador en `http://localhost:3000/index.html`

---

## 🤖 Principales Funcionalidades

| Función | Descripción |
|----------|--------------|
| 🎙️ **Asistente de voz (ConRumbo Bot)** | Escucha al usuario y transcribe en tiempo real para ofrecer asistencia paso a paso. |
| 🧠 **IA de Reconocimiento Visual** | Identifica heridas o riesgos mediante la cámara del dispositivo. |
| 💓 **Monitoreo de signos vitales** | Muestra frecuencia cardíaca (bpm) y respiratoria (rpm). |
| 📋 **Instrucciones guiadas** | Proporciona instrucciones breves y claras en pantalla. |
| ☎️ **Botón de emergencia (112)** | Llama automáticamente a los servicios de emergencia. |
| 🔁 **Historial de instrucciones** | Permite revisar las últimas recomendaciones del sistema. |

---

## 🧬 Componentes de IA y Data Science

- **Speech Recognition:** `speech_recognition`, `gTTS`
- **Image Analysis:** `OpenCV`, `TensorFlow`, `MediaPipe`
- **NLP & Decision Models:** `transformers`, `scikit-learn`
- **Backend:** `Flask`, `Flask-CORS`
- **Frontend:** `HTML`, `CSS`, `JavaScript`

El sistema integra modelos de IA para:
- Clasificar el tipo de emergencia (herida, asfixia, desmayo, etc.)
- Generar respuestas guiadas mediante NLP
- Detectar visualmente lesiones con cámara activa

---

## 📊 Aplicación de Data Science e IA

| Área | Aplicación |
|------|-------------|
| **Data Science** | Análisis de patrones de uso y respuesta del usuario. |
| **IA Generativa** | Creación de instrucciones personalizadas según la situación. |
| **Reconocimiento Visual** | Detección automática de heridas y activación de protocolo. |
| **Procesamiento de Voz** | Conversación natural con el usuario para calmar y guiar. |

---

## 📱 Público Objetivo

- Estudiantes universitarios
- Jóvenes adultos en situaciones de emergencia
- Instituciones educativas y campus
- Programas de formación en primeros auxilios

---

## 💡 Futuras Mejoras

- 🗺️ Geolocalización automática y envío de ubicación al 112  
- 📦 Kits de primeros auxilios conectados a la app  
- 🧩 Módulos educativos con gamificación  
- 📈 Dashboard de análisis de emergencias por región  

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
