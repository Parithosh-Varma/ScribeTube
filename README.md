<p align="center">
  <br>
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=28&duration=3000&pause=500&color=F59E0B&center=true&vCenter=true&width=600&lines=ScribeTube;YouTube+%E2%86%92+Polished+Book+Chapters;From+Speech+to+Prose" alt="ScribeTube" />
</p>

<p align="center">
  <i>by <strong>Parithosh Varma</strong></i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-000?logo=react&logoColor=61DAFB&labelColor=111" />
  <img src="https://img.shields.io/badge/Vite-7-000?logo=vite&logoColor=646CFF&labelColor=111" />
  <img src="https://img.shields.io/badge/Tailwind-4-000?logo=tailwindcss&logoColor=06B6D4&labelColor=111" />
  <img src="https://img.shields.io/badge/TypeScript-5-000?logo=typescript&logoColor=3178C6&labelColor=111" />
  <img src="https://img.shields.io/badge/Python-3.9-000?logo=python&logoColor=3776AB&labelColor=111" />
  <img src="https://img.shields.io/badge/Flask-3-000?logo=flask&logoColor=white&labelColor=111" />
  <img src="https://img.shields.io/badge/license-MIT-000?labelColor=111&color=green" />
</p>

<br>

<p align="center">
  <strong>Turn any YouTube video into a beautifully formatted book chapter.</strong><br>
  Paste a link → fetch the transcript → instantly generate structured prose with headers, takeaways & clean typography.<br>
  No API key required. Runs locally.
</p>

<br>

<p align="center">
  <img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">
</p>

## ⚡ One-liner

> YouTube transcript in, polished book chapter out. No API keys needed. No cloud dependencies. Just Python + React.

---

## ✨ What It Does

| Capability | How |
|------------|-----|
| **Fetch any YouTube transcript** | Local Python backend → `youtube-transcript-api` → no CORS, no rate limits, no proxies |
| **Format into a book chapter** | AI (Claude/GPT/Gemini) **or** built-in local heuristic editor — your choice |
| **Explore interactively** | Split workspace with video player, timestamped caption browser, and live chapter preview |
| **Export cleanly** | Plain text · Markdown · `.md` file · PDF print with full typographic control |

---

## 🚀 One-Minute Setup

```bash
# Terminal 1 — Backend
pip3 install youtube-transcript-api flask flask-cors
python3 server/server.py

# Terminal 2 — Frontend
npm install
npm run dev
```

Open **http://localhost:5173** and paste a YouTube URL.

---

## 🎯 Presets — No Setup Required

Click any card in the app to load an instant formatted chapter (zero config):

| Video | Speaker | Chapter Title |
|-------|---------|--------------|
| `UF8uR6Z6KLc` | **Steve Jobs** | *Stay Hungry, Stay Foolish* |
| `zjkBMFhNj_g` | **Andrej Karpathy** | *The Architecture of Digital Minds* |
| `ikAb-NYkseI` | **Neil Gaiman** | *The Mountain in the Distance* |
| `u4ZoJKF_VuA` | **Simon Sinek** | *The Golden Circle of Leadership* |
| `wHGqp8bsh9E` | **J.K. Rowling** | *The Architecture of Empathy and Failure* |

---

<p align="center">
  <img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">
</p>

## 🏗 Architecture

```
                         ┌──────────────────┐
                         │   Browser (5173) │
                         │  React 19 + Vite │
                         └────────┬─────────┘
                                  │ GET /api/transcript?v=xxx
                                  │ GET /api/metadata?v=xxx
                                  ▼
                         ┌──────────────────┐
                         │  Flask Backend   │
                         │  (localhost:8080)│
                         │ youtube-transcript-api
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
           ┌────────────────┐          ┌────────────────┐
           │  Local Editor  │          │  AI Providers   │
           │  (no key)      │          │  (optional)     │
           │  Heuristic MD  │          │  Claude / GPT   │
           │  formatting    │          │  / Gemini       │
           └────────────────┘          └────────────────┘
```

---

## 🗂 Project Layout

```
scribe-tube/
├── server/
│   └── server.py              # 55 lines — transcript & metadata API
├── src/
│   ├── App.tsx                # Main UI (~1300 lines)
│   ├── main.tsx               # Entry point
│   ├── index.css              # Tailwind v4 + custom animations
│   ├── data/
│   │   └── presets.ts         # 5 premium speech presets
│   └── utils/
│       ├── transcript.ts      # ID extraction + fetching
│       ├── ai.ts              # AI provider configs + API calls
│       ├── markdown.ts        # Markdown → styled HTML
│       └── cn.ts              # Tailwind class merger
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🎨 UI Highlights

- **Dark/Light theme** — persists in localStorage
- **Typography engine** — 3 fonts (serif/sans/mono), 4 sizes, 4 paper colors
- **Pipeline console** — animated step progress + live terminal logs
- **Smart first-letter drop-cap** — in serif book mode
- **Searchable captions** — filter transcript segments by keyword
- **Stylish print output** — clean A4 formatting with elegant dividing ornaments

---

<p align="center">
  <img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">
</p>

## ⚙️ Configuration

```
AI Provider   →  Local / Anthropic / OpenAI / Gemini
API Key       →  Stored in localStorage (never leaves your browser)
Font          →  Serif / Sans / Mono
Font Size     →  SM / BASE / LG / XL
Paper         →  Cream / White / Stone / Dark
```

---

## 📦 Build for Production

```bash
npm run build
```

Outputs a **single self-contained `dist/index.html`** (~370 KB) with everything inlined. Deploy anywhere.

---

## 🤝 Contributing

Ideas for next-level stuff:

- 🤖 More AI providers (Groq, Ollama, Mistral)
- 🎙 Speaker diarization from transcript
- 📖 EPUB / MOBI export
- 📱 Better mobile layout
- 🌍 Multi-language caption support

PRs welcome.

---

## 📄 License

MIT — free for any use.

---

<p align="center">
  <sub>Made by <strong>Parithosh Varma</strong> · built with React, Flask, and a love for good prose.</sub>
  <br>
  <sub><i>"The best way to learn is to read. The best way to remember is to write."</i></sub>
</p>