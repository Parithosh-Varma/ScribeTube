<p align="center">
  <img src="src/LOGO/logo.png" alt="ScribeTube" width="80">
</p>

<p align="center">
  <strong style="font-size:24px">ScribeTube</strong><br>
  <i>YouTube → Polished Book Chapter</i>
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

Or start both at once:

```bash
npm start
```

Open **http://localhost:5173** and paste a YouTube URL.

---

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
youtube-transcript-book-converter/
├── server/
│   └── server.py              # Flask backend — transcript & metadata API
├── src/
│   ├── App.tsx                # Main UI
│   ├── main.tsx               # Entry point
│   ├── index.css              # Tailwind v4 + design tokens
│   ├── LOGO/
│   │   └── logo.png           # App logo
│   ├── data/
│   │   └── presets.ts         # (empty — presets removed)
│   └── utils/
│       ├── transcript.ts      # ID extraction, fetching, local formatter
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

- **Literary design system** — Fraunces serif, Inter UI, JetBrains Mono for raw data
- **Editing desk layout** — narrow Configure rail + wide Manuscript Page panel
- **Before/after strip** — visualizes raw transcript → polished prose transformation
- **Dark/Light theme** — Reading Room dark, Manuscript Page light
- **Oxblood + Brass palette** — book-cover aesthetic, not SaaS dashboard
- **Stamp press button** — Generate button clicks down like a printing press
- **Smart first-letter drop-cap** — in serif book mode
- **Searchable captions** — filter transcript segments by keyword
- **PDF print output** — clean A4 formatting with elegant dividing ornaments
- **Reduced motion** — respects `prefers-reduced-motion`
- **Brass focus states** — keyboard navigation with brass ring outlines

---

## ⚙️ Configuration

```
AI Provider   →  Local / Anthropic / OpenAI / Gemini
API Key       →  Stored in localStorage (never leaves your browser)
Font          →  Serif / Sans / Mono
Font Size     →  SM / BASE / LG / XL
Theme         →  Dark (Reading Room) / Light (Manuscript Page)
```

---

## 📦 Build for Production

```bash
npm run build
```

Outputs a **single self-contained `dist/index.html`** with everything inlined. Deploy anywhere.

---

## 🤝 Contributing

Ideas for next-level stuff:

- More AI providers (Groq, Ollama, Mistral)
- Speaker diarization from transcript
- EPUB / MOBI export
- Multi-language caption support

PRs welcome.

---

## 📄 License

MIT — free for any use.

---

<p align="center">
  <sub>Made by <strong>Parithosh Varma</strong> · built with React, Flask, and a love for good prose.</sub>
</p>
