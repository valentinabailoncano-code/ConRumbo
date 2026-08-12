# 🚑 ConRumbo – Asistente Inteligente de Primeros Auxilios

> “Mantén la calma. Te guiaré paso a paso.”

**ConRumbo** es una aplicación educativa y de asistencia en primeros auxilios que combina **inteligencia artificial, interacción por voz y reconocimiento visual** para ofrecer orientación inmediata ante situaciones de emergencia.

Diseñada especialmente para **universitarios y jóvenes adultos**, busca facilitar el acceso a instrucciones de primeros auxilios de forma clara, accesible, empática y tecnológica.

---

## 🧠 Objetivo del Proyecto

Este proyecto forma parte del **Trabajo Fin de Máster en Data Science & IA (Evolve Máster)**.

Su propósito es desarrollar una plataforma inteligente capaz de **asistir y educar al usuario ante emergencias cotidianas**, aplicando inteligencia artificial, procesamiento de lenguaje natural, reconocimiento de voz, análisis de datos y tecnologías web.

El sistema incorpora:

- 🎙️ Interacción mediante voz
- 📝 Transcripción de audio
- 🗣️ Respuestas habladas mediante Text-to-Speech
- 📷 Acceso a cámara y reconocimiento visual
- 💓 Análisis y registro de signos vitales
- 🧠 Procesamiento NLP de la situación
- ☎️ Acceso rápido al 112
- 📊 Registro de métricas de uso
- 📱 Compatibilidad con escritorio y dispositivos móviles
- 🔒 Comunicación HTTPS local para acceso seguro a micrófono y cámara

---

## 🌐 Vista Principal de la App

La interfaz está diseñada para ofrecer un entorno **claro, calmado y sencillo de utilizar en situaciones de estrés**.

Incluye:

- Mensaje principal: *“Mantén la calma. Te guiaré paso a paso.”*
- Botón **Iniciar** para comenzar la asistencia
- Botón de micrófono para hablar con **ConRumbo Bot**
- Panel de transcripción en vivo
- Respuestas mediante voz
- Monitor de signos vitales
- Indicadores de análisis visual
- Botón para llamar al 112
- Historial de instrucciones recientes
- Panel de ajustes de idioma, apariencia y servidor

---

## 🧩 Estructura del Proyecto

```text
ConRumbo MVP/
│
├── backend/
│   ├── .venv/                 # Entorno virtual local
│   ├── app.py                 # Servidor Flask principal y API
│   ├── emergency_bot.py       # Lógica del asistente y flujo conversacional
│   ├── metrics.py             # Procesamiento y análisis de métricas
│   ├── metrics_log.csv        # Registro local de métricas
│   ├── nlp_processor.py       # Procesamiento de lenguaje natural
│   └── protocols.json         # Protocolos estructurados de primeros auxilios
│
├── frontend/
│   ├── assets/                # Recursos visuales
│   ├── index.html             # Interfaz principal
│   ├── style.css              # Diseño visual y responsive
│   ├── script.js              # Voz, STT, TTS, cámara y comunicación con API
│   ├── sw.js                  # Service Worker
│   └── manifest.webmanifest   # Configuración PWA
│
├── certs/                     # Certificados HTTPS locales (NO subir a GitHub)
│
├── https_frontend.py          # Servidor HTTPS local para el frontend
├── requirements.txt           # Dependencias Python
├── start_dev.bat              # Script de arranque para Windows
├── start_dev.sh               # Script de arranque para sistemas Unix
├── README.md                  # Documentación del proyecto
├── README_QUICKSTART.md       # Guía rápida de ejecución
├── LICENSE_ConRumbo.txt       # Licencia
└── .gitignore                 # Archivos excluidos de Git
```

---

## ⚙️ Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/valentinabailoncano-code/ConRumbo.git
cd ConRumbo
```

### 2. Crear el entorno virtual

Desde la carpeta raíz del proyecto:

```powershell
cd backend
python -m venv .venv
```

Activarlo en Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Volver a la raíz:

```powershell
cd ..
```

### 3. Instalar dependencias

Con el entorno virtual activado:

```powershell
pip install -r requirements.txt
```

---

## 🔐 Configuración HTTPS

ConRumbo utiliza **HTTPS durante el desarrollo local** para permitir que dispositivos móviles, especialmente iPhone/iOS, puedan utilizar correctamente funciones protegidas del navegador como el micrófono.

### Instalar mkcert

En Windows:

```powershell
winget install --id FiloSottile.mkcert -e
```

Comprobar la instalación:

```powershell
mkcert -version
```

Si Windows ha instalado `mkcert` pero PowerShell todavía no reconoce el comando, cierra y vuelve a abrir PowerShell.

### Instalar la autoridad certificadora local

```powershell
mkcert -install
```

### Obtener la IP local del ordenador

```powershell
ipconfig
```

Busca la dirección:

```text
Dirección IPv4
```

Por ejemplo:

```text
10.32.86.31
```

> ⚠️ La IP puede cambiar cuando el ordenador se conecta a otra red Wi-Fi.

### Crear los certificados

Desde la raíz del proyecto:

```powershell
mkdir certs
cd certs
mkcert <IP_LOCAL> localhost 127.0.0.1
```

Por ejemplo:

```powershell
mkcert 10.32.86.31 localhost 127.0.0.1
```

Esto genera un certificado y su clave privada dentro de `certs/`.

### ⚠️ Importante: certificados privados

La carpeta:

```text
certs/
```

debe permanecer en `.gitignore`.

Las claves privadas generadas por `mkcert` **no deben subirse al repositorio de GitHub**.

---

## 📱 Configuración HTTPS en iPhone

Para utilizar ConRumbo desde un iPhone es necesario confiar en la autoridad certificadora local creada por `mkcert`.

Para localizarla:

```powershell
mkcert -CAROOT
```

En Windows mostrará una ruta similar a:

```text
C:\Users\<USUARIO>\AppData\Local\mkcert
```

Dentro se encuentra:

```text
rootCA.pem
```

Este certificado debe instalarse en el iPhone.

Una vez descargado en el dispositivo:

1. Abrir **Ajustes**
2. Entrar en **Perfil descargado**
3. Instalar el perfil
4. Ir a **Ajustes → General → Información**
5. Entrar en **Ajustes de confianza de certificados**
6. Activar la confianza completa para el certificado de `mkcert`

Esto permite que el iPhone confíe en el HTTPS local utilizado por ConRumbo.

---

## 🎬 Ejecutar ConRumbo

Para utilizar la aplicación deben estar funcionando simultáneamente:

1. El backend Flask
2. El frontend HTTPS

### Terminal 1 — Backend

Desde la raíz del proyecto:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python app.py
```

El backend utiliza el puerto:

```text
8000
```

En desarrollo estará disponible en direcciones similares a:

```text
https://127.0.0.1:8000
https://<IP_LOCAL>:8000
```

Por ejemplo:

```text
https://10.32.86.31:8000
```

### Terminal 2 — Frontend

Desde la raíz del proyecto:

```powershell
python https_frontend.py
```

El frontend utiliza el puerto:

```text
3000
```

En el ordenador puede abrirse mediante:

```text
https://localhost:3000
```

o mediante:

```text
https://<IP_LOCAL>:3000
```

Por ejemplo:

```text
https://10.32.86.31:3000
```

---

## 📱 Ejecutar ConRumbo en iPhone

El ordenador y el iPhone deben estar conectados a la **misma red Wi-Fi**.

Con backend y frontend funcionando, abrir en Safari:

```text
https://<IP_LOCAL>:3000
```

Por ejemplo:

```text
https://10.32.86.31:3000
```

En **Ajustes → Servidor** dentro de ConRumbo, configurar el backend como:

```text
https://<IP_LOCAL>:8000
```

Por ejemplo:

```text
https://10.32.86.31:8000
```

Después:

1. Pulsar **Guardar**
2. Comprobar que el servidor responde
3. Pulsar **Iniciar**
4. Conceder permiso de micrófono cuando iOS lo solicite

> La IP utilizada en estos ejemplos es únicamente ilustrativa. Debe utilizarse la IP correspondiente a la red actual.

---

## 🎙️ Reconocimiento y Transcripción de Voz

ConRumbo permite al usuario describir mediante voz qué está ocurriendo.

El flujo general es:

```text
Usuario habla
      ↓
El navegador captura el audio
      ↓
El audio se envía al backend
      ↓
Procesamiento del audio
      ↓
Speech-to-Text
      ↓
Transcripción
      ↓
Procesamiento NLP
      ↓
ConRumbo determina la respuesta
      ↓
Text-to-Speech
      ↓
ConRumbo responde en voz alta
```

En dispositivos móviles el sistema puede enviar el audio al backend para realizar la transcripción.

---

## 🎬 FFmpeg

Para mejorar la compatibilidad con formatos de audio procedentes de dispositivos móviles, ConRumbo utiliza **FFmpeg**.

### Instalar FFmpeg en Windows

```powershell
winget install --id Gyan.FFmpeg -e
```

Después de instalarlo, puede ser necesario cerrar y volver a abrir PowerShell para actualizar la variable `PATH`.

Comprobar la instalación:

```powershell
ffmpeg -version
```

FFmpeg permite convertir determinados formatos de audio capturados por navegadores móviles antes de procesarlos mediante Speech-to-Text.

---

## 🔊 Text-to-Speech

ConRumbo puede reproducir en voz alta las respuestas e instrucciones generadas durante la interacción.

El sistema controla el ciclo de conversación para evitar que el propio audio del asistente sea interpretado como una nueva respuesta del usuario:

```text
ConRumbo reproduce la instrucción
          ↓
Termina la reproducción
          ↓
Espera
          ↓
Reactiva la escucha
          ↓
El usuario puede responder
```

Esto evita bucles en los que el sistema se escucha a sí mismo y vuelve a procesar automáticamente su propia respuesta.

---

## 🤖 Funcionalidades Principales

| Función | Descripción |
|---|---|
| 🎙️ **ConRumbo Bot** | Asistente interactivo controlado mediante voz |
| 📝 **Speech-to-Text** | Transcripción del audio del usuario |
| 🔊 **Text-to-Speech** | Reproducción en voz alta de instrucciones |
| 🧠 **Procesamiento NLP** | Interpretación de la situación y las respuestas |
| 💓 **Módulo de métricas** | Procesamiento y registro de métricas |
| 📋 **Protocolos JSON** | Protocolos estructurados de primeros auxilios |
| 📷 **Análisis visual** | Uso de la cámara como fuente de información visual |
| ☎️ **Botón 112** | Acceso rápido al servicio de emergencias |
| 🌐 **PWA** | Arquitectura Progressive Web App |
| 📱 **Soporte móvil** | Funcionamiento desde dispositivos móviles |
| 🔐 **HTTPS local** | Acceso seguro a funciones protegidas del navegador |

---

## 🧬 Inteligencia Artificial y Data Science

El proyecto combina diferentes componentes tecnológicos:

| Área | Tecnologías | Aplicación |
|---|---|---|
| 🔊 Voz | Speech Recognition / STT / TTS | Interacción hablada |
| 🧠 NLP | Python y procesamiento de lenguaje | Interpretación de respuestas |
| 👁️ Visión | Tecnologías de cámara y visión | Análisis visual |
| 📊 Data | Python / CSV / métricas | Registro y análisis |
| ⚙️ Backend | Flask / Flask-CORS | API y procesamiento |
| 💻 Frontend | HTML / CSS / JavaScript | Interfaz y lógica del navegador |
| 🎬 Audio | FFmpeg | Conversión y compatibilidad de audio |
| 🔐 Seguridad local | HTTPS / mkcert | Acceso desde dispositivos móviles |

---

## 📊 Aplicaciones de IA en el MVP

- Identificación del tipo de emergencia a partir de las respuestas del usuario
- Interpretación de lenguaje natural
- Generación de instrucciones adaptadas al flujo de actuación
- Interacción conversacional mediante voz
- Transcripción automática
- Procesamiento de audio procedente de dispositivos móviles
- Uso de información visual mediante cámara
- Monitorización y registro de métricas
- Adaptación del flujo según las respuestas recibidas

---

## 💻 Compatibilidad Actual

| Plataforma / Funcionalidad | Estado |
|---|---|
| Windows / navegador desktop | ✅ Funcional |
| iPhone / iOS | ✅ Funcional |
| Micrófono desktop | ✅ Funcional |
| Micrófono iPhone | ✅ Funcional |
| Transcripción desktop | ✅ Funcional |
| Transcripción iPhone | ✅ Funcional |
| Respuesta por voz | ✅ Funcional |
| Comunicación frontend-backend | ✅ Funcional |
| HTTPS local | ✅ Funcional |

> ⚠️ El rendimiento puede depender de la red utilizada. En determinadas redes corporativas, la carga inicial de la aplicación móvil puede ser considerablemente más lenta.

---

## 🔧 Solución de Problemas

### El móvil no puede abrir ConRumbo

Comprobar:

- Ordenador e iPhone conectados a la misma red
- Backend funcionando
- Frontend funcionando
- IP local correcta
- Certificado instalado y marcado como confiable en iOS

### El micrófono no funciona en iPhone

Comprobar:

- La aplicación se está abriendo mediante `https://`
- Safari tiene permiso para utilizar el micrófono
- El certificado local es de confianza
- El backend responde correctamente

### Aparece un error de transcripción

Comprobar:

```powershell
ffmpeg -version
```

y verificar que el backend está recibiendo peticiones al endpoint STT.

### La aplicación funciona pero tarda mucho en cargar

El rendimiento de la carga inicial puede verse afectado por:

- Redes Wi-Fi corporativas
- Restricciones internas de red
- Latencia entre móvil y ordenador
- Caché del navegador
- Service Worker
- Recursos estáticos

Una vez cargada, la interacción puede funcionar con normalidad aunque la carga inicial haya sido lenta.

---

## 🎯 Público Objetivo

- Estudiantes universitarios
- Jóvenes adultos
- Personas que viven solas
- Centros educativos
- Empresas con programas de formación
- Personas que quieran aprender cómo actuar inicialmente ante determinadas emergencias

---

## 🚀 Futuras Mejoras

- ⚡ Optimización de la velocidad de carga en dispositivos móviles
- 📍 Geolocalización
- 👤 Personalización según nivel de experiencia
- 🗣️ Mejora del asistente conversacional
- 🧠 Mayor capacidad de interpretación contextual mediante IA
- 👁️ Evolución del módulo de visión artificial
- 🧰 Integración con ConRumbo Kits
- 📊 Dashboard de estadísticas y métricas
- 🔐 Sistema de usuarios
- 📱 Optimización PWA
- 🌐 Mejora del funcionamiento offline
- 🎙️ Mayor robustez del sistema de voz entre navegadores
- ☁️ Despliegue del backend y frontend en infraestructura cloud

---

## ⚠️ Aviso Importante

ConRumbo es actualmente un **prototipo/MVP académico y educativo**.

La aplicación **no sustituye la asistencia de profesionales sanitarios ni los servicios oficiales de emergencia**.

Ante una emergencia real debe contactarse con el servicio oficial de emergencias correspondiente. En España:

**☎️ 112**

---

## 👩‍💻 Autora

**Valentina Bailon Cano**

📍 Universidad Pontificia Comillas – ICADE  
🎓 Máster en Data Science & IA – Evolve Máster

---

## 📜 Licencia

Este proyecto está bajo licencia **MIT**.

Puede utilizarse, modificarse y distribuirse de acuerdo con los términos de dicha licencia.

---

### 🩹 *ConRumbo — La calma es el primer paso para salvar una vida.*