# ScribeTube

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3-000000?logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

<p align="center">
  <strong>Turn any YouTube video into a polished, readable book chapter.</strong><br>
  Paste a URL → fetch transcript locally → get formatted Markdown with headers, clean prose &amp; key takeaways.
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Local transcript fetching** | Python backend uses `youtube-transcript-api` — no CORS issues, no fragile proxies |
| **AI-powered formatting** | Optional: Anthropic Claude, OpenAI GPT, Google Gemini (bring your own key) |
| **Zero-key local formatter** | Built-in smart heuristic editor works completely offline |
| **Curated presets** | 5 famous speeches load instantly (Jobs, Karpathy, Gaiman, Sinek, Rowling) |
| **Split workspace** | Video player · searchable timestamped transcript · formatted chapter |
| **Typography controls** | Serif / Sans / Mono · 4 sizes · Cream / White / Stone / Dark paper |
| **Export** | Copy plain text · Copy Markdown · Download `.md` · Print to PDF |

---

## 🚀 Quick Start

```bash
# 1. Frontend deps
npm install

# 2. Backend deps
pip3 install youtube-transcript-api flask flask-cors

# 3. Run both (separate terminals)
python3 server/server.py   # http://localhost:8080
npm run dev                # http://localhost:5173
```

Open **http://localhost:5173** 🎉

---

## 🎯 Presets (Instant, No API Key)

| Video | Speaker | Event |
|-------|---------|-------|
| `UF8uR6Z6KLc` | Steve Jobs | Stanford 2005 Commencement |
| `zjkBMFhNj_g` | Andrej Karpathy | Intro to Large Language Models |
| `ikAb-NYkseI` | Neil Gaiman | "Make Good Art" — UArts 2012 |
| `u4ZoJKF_VuA` | Simon Sinek | TED: Start With Why |
| `wHGqp8bsh9E` | J.K. Rowling | Harvard 2008 Commencement |

Click any preset card → instant formatted chapter.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite + Tailwind v4)                  │
│  ├── Video input, provider config, theme controls          │
│  ├── Pipeline log console (animated steps)                 │
│  ├── Split workspace: Player | Transcript | Chapter        │
│  └── Export: Copy / Download / Print                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch("/api/transcript?v=...")
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (Flask + youtube-transcript-api)                  │
│  ├── GET /api/transcript?v=<id> → [{text,start,dur}, ...]  │
│  └── GET /api/metadata?v=<id>  → {title,channel,thumb...}  │
└─────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
            ┌───────────┐   ┌───────────┐
            │  Local    │   │  AI APIs  │
            │  Formatter│   │ (optional)│
            └───────────┘   └───────────┘
```

---

## 📦 Project Structure

```
.
├── server/
│   └── server.py              # Flask API (transcript + metadata)
├── src/
│   ├── App.tsx                # Main component (~1300 lines)
│   ├── main.tsx               # Entry point
│   ├── index.css              # Tailwind v4 + fonts + animations
│   ├── data/
│   │   └── presets.ts         # 5 curated speech presets
│   └── utils/
│       ├── transcript.ts      # YouTube ID, fetch transcript/metadata
│       ├── ai.ts              # Anthropic/OpenAI/Gemini via corsproxy.io
│       ├── markdown.ts        # Markdown → styled HTML parser
│       └── cn.ts              # clsx + tailwind-merge helper
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

---

## ⚙️ Configuration

- **API keys** → stored in `localStorage` per provider (never leave your browser)
- **Theme, font, paper** → persist in `localStorage`
- **Model selection** → auto-saves per provider

---

## 📦 Production Build

```bash
npm run build
```

Outputs a **single self-contained `dist/index.html`** (~370 KB gzipped) via `vite-plugin-singlefile`. Deploy anywhere static hosting works.

---

## 🤝 Contributing

PRs welcome! Areas that'd love help:

- More AI providers (Groq, Together, local LLMs via Ollama)
- Better transcript segment merging / speaker diarization
- EPUB export
- Mobile layout polish

---

## 📄 License

MIT — do whatever you want.

---

<p align="center">
  <sub>Built with ❤️ for anyone who learns better by reading than watching.</sub>
</p>