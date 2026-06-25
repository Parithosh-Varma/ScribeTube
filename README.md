# ScribeTube

Convert YouTube videos into polished, readable book chapters. Paste a URL, fetch the transcript, and get formatted Markdown with headers, clean prose, and key takeaways. Export as Markdown, plain text, or PDF.

## Features

- **Local transcript fetching** — Python backend uses `youtube-transcript-api` (no CORS issues, no third-party proxies)
- **AI-powered formatting** — Optional integration with Anthropic Claude, OpenAI GPT, or Google Gemini
- **Built-in local formatter** — Smart heuristic editor works without any API keys
- **Curated presets** — 5 famous speeches (Steve Jobs, Andrej Karpathy, Neil Gaiman, Simon Sinek, J.K. Rowling) load instantly
- **Interactive workspace** — Side-by-side video player, searchable timestamped transcript, and formatted chapter viewer
- **Typography controls** — Serif/sans/mono fonts, adjustable size, cream/white/stone/dark paper themes
- **Export** — Copy plain text, copy Markdown, download `.md` file, or print to PDF

## Quick Start

```bash
# 1. Install frontend dependencies
npm install

# 2. Install Python backend dependencies
pip3 install youtube-transcript-api flask flask-cors

# 3. Start both servers (run in separate terminals)
python3 server/server.py        # Backend on http://localhost:8080
npm run dev                     # Frontend on http://localhost:5173
```

Open http://localhost:5173 in your browser.

## Architecture

| Component | Tech | Purpose |
|-----------|------|---------|
| Frontend | React 19 + Vite + Tailwind CSS v4 | UI, transcript display, chapter rendering |
| Backend | Flask + youtube-transcript-api | Fetches YouTube transcripts & metadata |
| AI (optional) | Anthropic / OpenAI / Gemini | Polished chapter generation via CORS proxy |

## Usage

1. **Paste a YouTube URL** (watch link, youtu.be, shorts, or bare 11-char ID)
2. **Choose AI provider** — "Play Sandbox / Local Formatter" needs no key; others require your own API key
3. **Click "Fetch Transcript & Generate Book Chapter"**
4. **Explore** — Switch between video player, raw transcript (searchable by timestamp), and formatted chapter
5. **Export** — Copy, download, or print to PDF

## Project Structure

```
.
├── server/
│   └── server.py           # Flask backend (transcript + metadata endpoints)
├── src/
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   ├── index.css           # Tailwind v4 + custom styles
│   ├── data/
│   │   └── presets.ts      # Curated speech presets
│   └── utils/
│       ├── transcript.ts   # YouTube ID extraction, transcript fetching
│       ├── ai.ts           # AI provider configs + chapter generation
│       ├── markdown.ts     # Markdown → styled HTML parser
│       └── cn.ts           # clsx + tailwind-merge helper
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## Presets (instant load, no API key needed)

| Video | Speaker | Source |
|-------|---------|--------|
| UF8uR6Z6KLc | Steve Jobs | Stanford 2005 Commencement |
| zjkBMFhNj_g | Andrej Karpathy | Intro to LLMs |
| ikAb-NYkseI | Neil Gaiman | "Make Good Art" |
| u4ZoJKF_VuA | Simon Sinek | TED: Golden Circle |
| wHGqp8bsh9E | J.K. Rowling | Harvard 2008 Commencement |

## Configuration

- **API keys** are stored in `localStorage` per provider (never sent elsewhere)
- **Theme, font, paper** preferences persist in `localStorage`
- **Model selection** auto-saves per provider

## Build for Production

```bash
npm run build
```

Outputs a single self-contained `dist/index.html` (~370 KB) via `vite-plugin-singlefile`.

## License

MIT