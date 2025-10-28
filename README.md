# INTERACTIVE LEARNING FRAMEWORK  
(Example Deployment: **Cosmon — Hand + Voice Interactive Solar System**)  

A modular platform for **real-time, multimodal educational experiences**, combining **3D visualization**, **hand-gesture interaction**, and **voice navigation**.  
Built for museums, classrooms, and immersive learning environments — adaptable to any educational domain (space, anatomy, geography, engineering, etc.).

---

## 🌍 What This Framework Enables

- **Touch-free interactivity** for public and classroom environments.  
- **Embodied learning** — students learn by moving, gesturing, and speaking, not just clicking.  
- **Multimodal accessibility** — gestures, voice, and visual feedback work together naturally.  
- **Reusable architecture** — plug in different 3D scenes (solar system, molecule, cell, city model).  

---

## 🪐 Example Use Case — COSMON

**Cosmon** is the showcase implementation of this framework:  
an immersive, real-time **3D solar system** built with **Three.js**, powered by **MediaPipe hand-gesture controls** and **voice navigation** (via a local ElevenLabs STT proxy).

Designed for museums, science centers, and classrooms, *Cosmon* turns astronomy education into a tactile, embodied experience.

---

## 🧠 Potential Adaptations by Domain

| Domain | Example Experience | Learning Outcome |
|--------|-------------------|------------------|
| **Biology** | 3D human anatomy you can rotate with gestures and explore organs by voice | Spatial understanding of body systems |
| **Geography** | Interactive Earth model — zoom into continents, say “Show Africa” | Geospatial awareness |
| **Physics** | Manipulate forces or vectors with hand motions | Kinesthetic visualization of physical laws |
| **Chemistry** | Build molecules by “grabbing” atoms in space | Structural chemistry understanding |
| **History / Art** | Explore 3D reconstructions of ancient cities | Immersive contextual learning |

---

## 🎯 Who This Is For

- **Museums / Science Centers** – durable, touch-free installations.  
- **K-12 & Higher Education** – active learning in classrooms and labs.  
- **Libraries / Makerspaces** – public STEM exploration kiosks.  
- **Corporate / Training Environments** – interactive simulations for onboarding or safety demos.  

---

## 💡 Why It Matters

- **Natural Interaction:** No controllers or menus — just hand and voice.  
- **Inclusive Learning:** Works across abilities and ages.  
- **Memory Retention:** Kinesthetic engagement increases recall.  
- **Scalable:** Same engine powers multiple domains with scene swaps.  

---

## 🧩 Core Features

- **3D Visualization Engine** (Three.js) with lighting, bloom, and physics.  
- **Gesture Recognition** (MediaPipe Tasks Vision):  
  - ✋ *Open palm*: zoom out  
  - ✊ *Closed fist*: zoom in  
  - ☝️ *One finger up*: orbit/rotate  
  - ✌️ *Two fingers*: toggle voice listening  
- **Voice Navigation** (Local proxy to ElevenLabs STT):  
  - “Open Mars,” “Next,” “Explain,” “Repeat.”  
- **Configurable Scene API:** Load any educational 3D dataset (planets, molecules, maps).  
- **On-screen Controls:** Lighting, labels, annotations, and accessibility settings.  

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Rendering** | Three.js + OrbitControls + UnrealBloomPass |
| **Gestures** | Google MediaPipe Tasks Vision |
| **Voice** | Local Node.js proxy → ElevenLabs STT |
| **UI / Build** | Vite + Tailwind + lil-gui |
| **Interaction Logic** | TypeScript modular event bus (gesture → camera → voice intent) |

---

## ⚙️ Getting Started

### 1. Install Dependencies
```bash
npm install
2. (Optional) Configure Voice STT Proxy
Create .env.local:

ini
Copy code
ELEVENLABS_API_KEY=your_key_here
STT_PROXY_PORT=4000
Run proxy:

bash
Copy code
npm run stt-proxy
3. Run the App
bash
Copy code
npm run dev
4. Build for Deployment
bash
Copy code
npm run build
🕹️ Controls Summary
Input	Action
Mouse	Orbit (drag), zoom (wheel)
Hand Gestures	Pinch = zoom, one-finger slide = rotate, peace sign = toggle voice
Voice	“Open Mars,” “Next,” “Previous,” “Stop,” “Repeat.”

🧩 Architecture Overview
Gesture Engine: Smooths MediaPipe landmark data, stabilizes via hysteresis, outputs compact Snapshot.

Control Bridge: Converts snapshots into camera motions using spherical coordinates.

Voice Intent Engine: Records short clips, sends to proxy, maps STT → intent → event.

Scene Abstraction: Each domain defines its own SceneModule (planets, anatomy, geography).

🧪 Known Requirements
Camera + mic permission required.

All landmark detection runs locally in browser.

Use Node 20 LTS on Windows (Tailwind/lightningcss support).

🚀 Roadmap
🔍 Domain-agnostic “Scene Plugin” loader (e.g., /scenes/biology/, /scenes/chemistry/)

🧭 Educator-curated narration layers and quiz overlays

🧑‍🏫 Multi-user “class mode” with shared state

♿ Full accessibility: captions, keyboard + gesture parity

🖥️ Kiosk-mode: idle attract loop + auto-reset
