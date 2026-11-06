# 🏠 Sistema Domótico Inteligente y Distribuido en Tiempo Real

Proyecto de arquitectura cliente-servidor distribuida desarrollado en **Node.js**, **Socket.IO** y **MongoDB**. El sistema actúa como un agente domótico centralizado capaz de recibir telemetría de sensores, tomar decisiones automáticas basadas en eventos complejos y contexto meteorológico externo, controlar actuadores en tiempo real, persistir el historial de eventos y emitir notificaciones nativas de escritorio.

---

## Características Principales

* **Comunicación Bi-direccional en Tiempo Real:** Uso de WebSockets con **Socket.IO** para actualizar instantáneamente la interfaz de usuario y el simulador de sensores sin refrescar la página.
* **Lógica Domótica Inteligente & Reglas de Eficiencia Energética:**
  * **Ahorro energético:** Desconexión automática del aire acondicionado si se detecta ausencia de personas.
  * **Protección solar:** Cierre automático de persianas si la luminosidad supera el 80%.
  * **Control de temperatura:** Gestión automática del climatizador ante temperaturas extremas (< 15 °C o > 30 °C).
* **Integración con API Meteorológica Externa:** Consulta asíncrona periódica (cada 10 min) a la API de `wttr.in` para obtener la temperatura exterior en Granada. Si hace más fresco fuera que dentro, el agente sugiere ventilación natural antes de encender el aire.
* **Persistencia de Datos en MongoDB:** Registro estructurado de eventos (lecturas de sensores, cambios de estado en actuadores y alarmas) con consultas optimizadas y asíncronas (`async/await`).
* **Notificaciones Nativas del Sistema Operativo:** Emisión de alertas emergentes de escritorio (`node-notifier`) ante situaciones críticas o recomendaciones del sistema.

---

## Tecnologías Utilizadas

* **Backend:** Node.js (ES Modules, `"type": "module"`)
* **Comunicación en tiempo real:** Socket.IO v4.8
* **Base de Datos:** MongoDB v7.2 (Driver oficial para Node.js)
* **Notificaciones del Sistema:** node-notifier v10.0
* **Frontend:** HTML5, CSS3 (Variables CSS, Diseño Responsive con Inter Font) y JavaScript vanilla
* **API Externa:** API REST pública de clima (`wttr.in`)

---

## 📁 Estructura del Proyecto

```text
.
├── server.js          # Agente central, servidor HTTP, lógica domótica y conexión MongoDB
├── usuario.html       # Panel de Control del Usuario (Visualización, Actuadores y Alarmas)
├── sensor.html        # Panel del Simulador de Sensores (Entrada de datos en tiempo real)
├── stle.css           # Estilos globales y componentes UI (Cards, Grid, Status)
├── package.json       # Definición de dependencias y configuración ESM
└── package-lock.json  # Bloqueo de versiones de dependencias
