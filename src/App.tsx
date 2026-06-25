import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, Settings, Copy, Download, Check, FileText,
  AlertCircle, Terminal, ChevronRight, Eye, EyeOff, RotateCcw,
  Type, Search, HelpCircle, Printer, Edit2, ListRestart,
  Video, Sun, Moon
} from "lucide-react";
import { extractVideoId, fetchVideoMetadata, fetchTranscript, formatLocalBookChapter, VideoMetadata, TranscriptSegment } from "./utils/transcript";
import { aiProviders, generateBookChapter } from "./utils/ai";
import { parseMarkdownToHtml } from "./utils/markdown";
import { ProfileCard } from "./components/ProfileCard";
import { MouseProvider } from "./components/ui/use-mouse";

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem("scribetube_theme");
    return saved === "light" ? "light" : "dark";
  });
  const [activeTab, setActiveTab] = useState<'input' | 'editor' | 'help'>('input');
  const [videoUrl, setVideoUrl] = useState("");
  const [provider, setProvider] = useState(() => localStorage.getItem("scribetube_provider") || "local");
  const [apiKey, setApiKey] = useState(() => {
    const p = localStorage.getItem("scribetube_provider") || "local";
    return localStorage.getItem(`scribetube_${p}_key`) || "";
  });
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [bookStyle, setBookStyle] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [formattedChapter, setFormattedChapter] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftTab, setLeftTab] = useState<'player' | 'transcript'>('player');
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualChannel, setManualChannel] = useState("");
  const [manualText, setManualText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<'idle' | 'url' | 'metadata' | 'captions' | 'ai' | 'done'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied_text' | 'copied_md'>('idle');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("scribetube_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("scribetube_provider", provider);
    setApiKey(localStorage.getItem(`scribetube_${provider}_key`) || "");
    const provConfig = aiProviders.find(p => p.id === provider);
    if (provConfig) setSelectedModel(provConfig.defaultModel);
  }, [provider]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  const addLog = (msg: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString([], { hour12: false })}] ${msg}`]);
  const saveApiKey = (key: string) => { setApiKey(key); localStorage.setItem(`scribetube_${provider}_key`, key); };

  const handleReset = () => {
    setVideoUrl(""); setVideoMetadata(null); setTranscriptSegments([]); setFormattedChapter("");
    setIsManualInput(false); setManualText(""); setManualTitle(""); setManualChannel("");
    setError(null); setLogs([]); setProgressStep('idle'); setActiveTab('input');
  };

  const startGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLogs([]); setIsLoading(true);
    if (isManualInput) await runManualWorkflow(); else await runScrapingWorkflow();
  };

  const runManualWorkflow = async () => {
    if (!manualTitle.trim()) { setError("Enter a chapter title"); setIsLoading(false); return; }
    if (!manualText.trim()) { setError("Paste the raw transcript text"); setIsLoading(false); return; }
    try {
      setProgressStep('metadata'); addLog("Processing manual transcript...");
      const title = manualTitle.trim(), channel = manualChannel.trim() || "Independent Creator";
      setVideoMetadata({ id: "manual-" + Date.now().toString().slice(-4), title, channel, thumbnail: "", url: "" });
      addLog(`Chapter: "${title}"`);
      setProgressStep('captions'); addLog(`${manualText.split(/\s+/).length} words loaded`);
      setTranscriptSegments(manualText.split(/\n+/).map((p, idx) => ({ text: p, start: idx * 30, duration: 30 })));
      setProgressStep('ai'); await executeAiFormatting(title, channel, manualText);
      setProgressStep('done'); addLog("Chapter generated!"); setActiveTab('editor'); setLeftTab('transcript');
    } catch (err: any) { setError(err.message); addLog(`[ERROR] ${err.message}`); }
    finally { setIsLoading(false); }
  };

  const runScrapingWorkflow = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { setError("Invalid YouTube URL"); setIsLoading(false); return; }
    try {
      setProgressStep('url'); addLog(`Video ID: ${videoId}`);
      setProgressStep('metadata'); addLog("Fetching video details...");
      const meta = await fetchVideoMetadata(videoId);
      setVideoMetadata(meta); addLog(`"${meta.title}" — ${meta.channel}`);
      setProgressStep('captions'); addLog("Fetching transcript...");
      const fetched = await fetchTranscript(videoId);
      addLog(`${fetched.segments.length} segments, ${fetched.rawText.split(/\s+/).length} words`);
      setTranscriptSegments(fetched.segments);
      setProgressStep('ai'); await executeAiFormatting(meta.title, meta.channel, fetched.rawText);
      setProgressStep('done'); addLog("Chapter complete!"); setActiveTab('editor'); setLeftTab('player');
    } catch (err: any) { setError(err.message); addLog(`[ERROR] ${err.message}`); }
    finally { setIsLoading(false); }
  };

  const executeAiFormatting = async (title: string, channel: string, text: string) => {
    if (provider === "local") {
      addLog("Local formatter running...");
      await new Promise(r => setTimeout(r, 1200));
      setFormattedChapter(formatLocalBookChapter(title, channel, text));
      addLog("Local formatter done");
    } else {
      addLog(`Sending to ${aiProviders.find(p => p.id === provider)?.name}...`);
      try {
        setFormattedChapter(await generateBookChapter(provider, apiKey, selectedModel, title, channel, text));
        addLog("AI response received");
      } catch (e: any) {
        addLog(`AI failed (${e.message}), falling back to local formatter`);
        setFormattedChapter(formatLocalBookChapter(title, channel, text));
        addLog("Local fallback done");
      }
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(formattedChapter.replace(/[#*`>_-]/g, "").replace(/\n{3,}/g, "\n\n"));
    setCopyStatus('copied_text'); setTimeout(() => setCopyStatus('idle'), 2000);
  };
  const handleCopyMarkdown = () => { navigator.clipboard.writeText(formattedChapter); setCopyStatus('copied_md'); setTimeout(() => setCopyStatus('idle'), 2000); };
  const handleDownloadMarkdown = () => {
    if (!videoMetadata) return;
    const blob = new Blob([formattedChapter], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chapter-${videoMetadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`; a.click();
    URL.revokeObjectURL(url);
  };
  const handlePrintPdf = () => {
    if (!videoMetadata || !formattedChapter) return;
    const pw = window.open("", "_blank");
    if (!pw) { alert("Please allow popups"); return; }
    const styledHtml = parseMarkdownToHtml(formattedChapter, bookStyle);
    const styleTag = `<style>
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;600;700&family=JetBrains+Mono&display=swap');
      body{margin:0;padding:50px;font-family:${bookStyle === 'serif' ? "'Fraunces', Georgia, serif" : bookStyle === 'mono' ? "'JetBrains Mono', monospace" : "'Inter', sans-serif"};color:#2B2D31;background:#fff;line-height:1.625;font-size:16px}
      .book-container{max-width:800px;margin:0 auto}
      h1,h2,h3{font-family:${bookStyle === 'serif' ? "'Fraunces', serif" : "inherit"};page-break-after:avoid;color:#20242B}
      h1{font-size:34px;text-align:center;margin-bottom:10px;font-weight:700;line-height:1.25}
      p.adapt{text-align:center;font-style:italic;color:#8A8D93;font-size:14px;margin-top:5px;margin-bottom:40px;border-bottom:1px solid #EDE7D4;padding-bottom:15px}
      h2{font-size:20px;margin-top:45px;margin-bottom:20px;border-bottom:1px solid #C9A463;padding-bottom:8px;letter-spacing:.05em;text-transform:uppercase}
      p{margin-bottom:1.5em;text-align:justify}
      blockquote{border-left:3px solid #8B3A3A;padding-left:20px;font-style:italic;margin:30px 0;color:#8A8D93}
      ol,ul{margin:20px 0;padding-left:25px}
      li{margin-bottom:10px;text-align:justify}
      pre{background:#F3EEDF;border:1px solid #C9A463;padding:15px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;margin:25px 0}
      .divider{text-align:center;margin:40px 0;color:#C9A463;letter-spacing:.2em;font-size:14px}
      @media print{body{padding:15px}@page{size:A4;margin:20mm}h1,h2,h3{page-break-after:avoid}p,li{orphans:3;widows:3}}
    </style>`;
    let html = styledHtml.replace(/<p class="text-lg text-gray-800 dark:text-zinc-200 leading-relaxed font-serif mb-6">\*Adapted from(.*?)<\/p>/, '<p class="adapt">*Adapted from$1</p>');
    pw.document.write(`<!DOCTYPE html><html><head><title>${videoMetadata.title}</title>${styleTag}</head><body><div class="book-container">${html}</div><script>window.onload=function(){setTimeout(()=>{window.print();window.close()},500)}<\/script></body></html>`);
    pw.document.close();
  };

  const formatTime = (s: number) => { const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`; };
  const filteredSegments = transcriptSegments.filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <MouseProvider>
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-reading-room text-manuscript' : 'bg-manuscript text-graphite'}`}>

      {/* ── HEADER ── */}
      <header className={`sticky top-0 z-50 h-14 flex items-center justify-between px-4 sm:px-6 border-b transition-colors ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleReset}>
          <img src="/logo.png" alt="ScribeTube" className="w-8 h-8 object-contain" />
          <span className="font-display text-lg font-bold tracking-tight hidden sm:block">
            ScribeTube
          </span>
        </div>
        <div className="flex items-center gap-2">
          {formattedChapter && activeTab !== 'editor' && (
            <button onClick={() => setActiveTab('editor')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-oxblood text-manuscript hover:bg-oxblood-hover active:animate-stamp transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> Workspace
            </button>
          )}
          <button onClick={() => setActiveTab(prev => prev === 'help' ? 'input' : 'help')} className={`p-2 rounded-lg transition-colors ${activeTab === 'help' ? (isDark ? 'bg-reading-room-light text-brass' : 'bg-manuscript-warm text-oxblood') : (isDark ? 'text-faded-ink hover:text-manuscript hover:bg-reading-room-light' : 'text-faded-ink hover:text-graphite hover:bg-manuscript-warm')}`}>
            <HelpCircle className="w-4 h-4" />
          </button>
          <button onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-faded-ink hover:text-manuscript hover:bg-reading-room-light' : 'text-faded-ink hover:text-graphite hover:bg-manuscript-warm'}`}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── HELP VIEW ── */}
      {activeTab === 'help' && (
        <div className="flex-1 flex items-center justify-center p-6 animate-fade-in">
          <div className={`max-w-2xl w-full p-8 sm:p-10 rounded-2xl border ${isDark ? 'bg-reading-room-light border-reading-room-light' : 'bg-warm-white border-manuscript-warm'}`}>
            <h2 className="font-display text-2xl font-bold mb-4">How ScribeTube Works</h2>
            <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-faded-ink' : 'text-faded-ink'}`}>
              Paste a YouTube URL. ScribeTube pulls the transcript, strips filler words, restructures sentences into prose, and outputs a polished book chapter with section headers and key takeaways.
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 text-sm">
                <span className="font-mono text-brass font-bold mt-0.5">01</span>
                <div><span className="font-semibold">Local Sandbox</span> — deterministic formatting, no API key needed. Handles filler removal, paragraph structuring, and takeaway generation entirely client-side.</div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="font-mono text-brass font-bold mt-0.5">02</span>
                <div><span className="font-semibold">AI Enhancement</span> — optional Claude, GPT, or Gemini integration for premium prose quality. Requires your own API key.</div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="font-mono text-brass font-bold mt-0.5">03</span>
                <div><span className="font-semibold">Manual Paste</span> — skip the URL entirely. Paste raw transcript text, add a title, and generate.</div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
              <h3 className="font-semibold text-sm mb-2">Manual transcript mode</h3>
              <ol className={`space-y-1 text-xs ${isDark ? 'text-faded-ink' : 'text-faded-ink'}`}>
                {["Open the YouTube video", 'Click "...more" in the description', 'Click "Show transcript"', "Select all text (Cmd+A) and copy", 'Toggle "Paste text manually" and paste'].map((s, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="font-mono text-brass font-bold">{i + 1}.</span>{s}</li>
                ))}
              </ol>
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={() => setActiveTab('input')} className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-oxblood text-manuscript hover:bg-oxblood-hover active:animate-stamp transition-colors">
                Get Started
              </button>
            </div>
            <div className="mt-8 flex justify-center">
              <ProfileCard />
            </div>
          </div>
        </div>
      )}

      {/* ── INPUT VIEW ── */}
      {activeTab === 'input' && (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Left Rail — Configure */}
          <aside className={`w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r p-5 transition-colors ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-4 h-4 text-brass" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider">Configure</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">Provider</label>
                <select value={provider} onChange={e => setProvider(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light text-manuscript focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite focus:border-oxblood'}`}>
                  {aiProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {provider !== "local" && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink">API Key</label>
                      <a href={aiProviders.find(p => p.id === provider)?.keyUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brass hover:text-brass-light flex items-center gap-0.5">
                        Get key <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => saveApiKey(e.target.value)} placeholder={aiProviders.find(p => p.id === provider)?.keyPlaceholder} className={`w-full pl-3 pr-9 py-2 rounded-lg border text-sm font-mono transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light text-manuscript focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite focus:border-oxblood'}`} />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faded-ink hover:text-manuscript">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">Model</label>
                    <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light text-manuscript focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite focus:border-oxblood'}`}>
                      {aiProviders.find(p => p.id === provider)?.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {provider === "local" && (
                <div className={`p-3 rounded-lg border text-xs leading-relaxed ${isDark ? 'bg-reading-room-light border-reading-room-light text-faded-ink' : 'bg-warm-white border-manuscript-warm text-faded-ink'}`}>
                  <span className="font-semibold text-brass">Local Sandbox</span> — deterministic editing. Filters filler words, restructures prose, generates takeaways. No API key required.
                </div>
              )}
            </div>
          </aside>

          {/* Main — Source Material */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-start justify-center p-6 sm:p-10">
              <div className="max-w-2xl w-full">
                {/* Signature Before/After Strip */}
                <div className={`mb-8 p-5 rounded-xl border transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light' : 'bg-warm-white border-manuscript-warm'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-oxblood" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-faded-ink">What this does</span>
                  </div>
                  <div className="space-y-3">
                    <div className={`font-mono text-xs leading-relaxed ${isDark ? 'text-faded-ink' : 'text-faded-ink'}`}>
                      <span className="text-brass font-bold">[2:14]</span> so basically, <span className="line-through decoration-brass/50">um</span> the thing is, <span className="line-through decoration-brass/50">you know</span> when you think about it...
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-brass/30" />
                      <svg className="w-4 h-4 text-oxblood shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      <div className="flex-1 h-px bg-brass/30" />
                    </div>
                    <div className={`font-display text-sm leading-relaxed italic ${isDark ? 'text-manuscript' : 'text-graphite'}`}>
                      "The fundamental question, when you strip away the noise, is this."
                    </div>
                  </div>
                </div>

                {/* Source Material Form */}
                <div className={`rounded-xl border transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light' : 'bg-warm-white border-manuscript-warm'}`}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-brass/20">
                    <div className="flex items-center gap-2.5">
                      <Video className="w-4 h-4 text-brass" />
                      <h3 className="font-display text-sm font-bold">Source Material</h3>
                    </div>
                    <button type="button" onClick={() => setIsManualInput(!isManualInput)} className="text-[11px] font-medium flex items-center gap-1 px-2.5 py-1 rounded-md border border-brass/30 text-faded-ink hover:text-brass hover:border-brass transition-colors">
                      <Edit2 className="w-3 h-3" />{isManualInput ? "YouTube URL" : "Paste manually"}
                    </button>
                  </div>

                  <form onSubmit={startGeneration} className="p-5 space-y-4">
                    {!isManualInput ? (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">YouTube URL or ID</label>
                        <div className="relative">
                          <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." disabled={isLoading} className={`w-full pl-3 pr-10 py-2.5 rounded-lg border text-sm font-mono transition-colors ${isDark ? 'bg-reading-room border-reading-room-light text-manuscript placeholder:text-faded-ink/50 focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite placeholder:text-faded-ink/50 focus:border-oxblood'}`} />
                          {videoUrl && <button type="button" onClick={handleReset} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-faded-ink hover:text-manuscript transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">Title</label>
                            <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Steve Jobs' Stanford Speech" className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${isDark ? 'bg-reading-room border-reading-room-light text-manuscript placeholder:text-faded-ink/50 focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite placeholder:text-faded-ink/50 focus:border-oxblood'}`} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">Speaker / Creator</label>
                            <input type="text" value={manualChannel} onChange={e => setManualChannel(e.target.value)} placeholder="Steve Jobs" className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${isDark ? 'bg-reading-room border-reading-room-light text-manuscript placeholder:text-faded-ink/50 focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite placeholder:text-faded-ink/50 focus:border-oxblood'}`} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-widest text-faded-ink mb-1.5">Raw Transcript</label>
                          <textarea rows={5} value={manualText} onChange={e => setManualText(e.target.value)} placeholder="Paste raw transcript text here..." className={`w-full px-3 py-2 rounded-lg border text-sm font-mono transition-colors resize-none ${isDark ? 'bg-reading-room border-reading-room-light text-manuscript placeholder:text-faded-ink/50 focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite placeholder:text-faded-ink/50 focus:border-oxblood'}`} />
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className={`p-3 rounded-lg border flex items-start gap-2.5 animate-fade-in ${isDark ? 'bg-oxblood-dark/20 border-oxblood/30 text-oxblood-hover' : 'bg-oxblood/5 border-oxblood/20 text-oxblood'}`}>
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold">{error}</p>
                          <p className="text-xs opacity-70 mt-0.5">Try pasting the transcript manually.</p>
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full py-3 rounded-lg font-semibold text-sm bg-oxblood text-manuscript hover:bg-oxblood-hover active:animate-stamp disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-manuscript/30 border-t-manuscript rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Generate Book Chapter</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PIPELINE LOGS (shown during loading) ── */}
      {isLoading && (
        <div className={`border-t transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light' : 'bg-warm-white border-manuscript-warm'}`}>
          <div className="max-w-4xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-oxblood animate-pulse" />
                <span className="font-display text-sm font-bold">Editorial Pipeline</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-faded-ink">{progressStep}</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                { id: 'url', name: 'URL' },
                { id: 'metadata', name: 'Meta' },
                { id: 'captions', name: 'Captions' },
                { id: 'ai', name: 'AI Edit' },
                { id: 'done', name: 'Format' },
              ].map((step, idx) => {
                const isCompleted = (progressStep === 'done') || (progressStep === 'ai' && idx < 3) || (progressStep === 'captions' && idx < 2) || (progressStep === 'metadata' && idx < 1);
                const isActive = progressStep === step.id;
                return (
                  <div key={step.id} className={`py-2 px-2 rounded-md text-center text-[10px] font-semibold uppercase tracking-wider transition-colors ${isCompleted ? 'bg-oxblood/10 text-oxblood' : isActive ? 'bg-brass/10 text-brass' : (isDark ? 'text-faded-ink/40' : 'text-faded-ink/40')}`}>
                    {step.name}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Terminal className="w-3 h-3 text-faded-ink" />
              <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-faded-ink">Log</span>
            </div>
            <div ref={logContainerRef} className={`h-32 rounded-lg border p-3 font-mono text-[11px] overflow-y-auto space-y-1 ${isDark ? 'bg-reading-room border-reading-room-light text-brass/80' : 'bg-manuscript border-manuscript-warm text-oxblood/80'}`}>
              {logs.length === 0 ? (
                <div className="text-faded-ink/50 italic">Waiting...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed border-l border-brass/20 pl-2.5">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WORKSPACE ── */}
      {formattedChapter && activeTab === 'editor' && (
        <div className="flex-1 flex flex-col animate-fade-in">
          {/* Workspace header */}
          {videoMetadata && (
            <div className={`px-4 sm:px-6 py-3 flex items-center justify-between border-b transition-colors ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
              <div className="flex items-center gap-3 min-w-0">
                {videoMetadata.thumbnail && (
                  <div className="w-10 h-7 rounded overflow-hidden shrink-0">
                    <img src={videoMetadata.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-brass">{videoMetadata.channel}</div>
                  <h2 className="font-display text-sm font-bold truncate">{videoMetadata.title}</h2>
                </div>
              </div>
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-brass/30 text-faded-ink hover:text-brass hover:border-brass transition-colors">
                <ListRestart className="w-3.5 h-3.5" /> New
              </button>
            </div>
          )}

          {/* Workspace body */}
          <div className="flex-1 flex flex-col lg:flex-row">
            {/* Left panel — Video / Transcript */}
            <div className={`w-full lg:w-96 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r transition-colors ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
              <div className={`flex border-b ${isDark ? 'border-reading-room-light' : 'border-manuscript-warm'}`}>
                {[
                  { id: 'player', icon: <Video className="w-3.5 h-3.5" />, label: 'Video' },
                  { id: 'transcript', icon: <FileText className="w-3.5 h-3.5" />, label: `Captions (${transcriptSegments.length})` },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setLeftTab(tab.id as any)} className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1.5 ${leftTab === tab.id ? 'border-oxblood text-oxblood' : `border-transparent ${isDark ? 'text-faded-ink/50 hover:text-faded-ink' : 'text-faded-ink/50 hover:text-faded-ink'}`}`}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 p-3 h-[400px] lg:h-auto">
                {leftTab === 'player' ? (
                  videoMetadata && videoMetadata.id && !videoMetadata.id.startsWith("manual-") ? (
                    <div className="h-full flex flex-col gap-3">
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-graphite">
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoMetadata.id}`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <FileText className={`w-10 h-10 mb-3 ${isDark ? 'text-faded-ink/30' : 'text-faded-ink/30'}`} />
                      <p className="text-xs text-faded-ink">No video embed for manual entries.</p>
                    </div>
                  )
                ) : (
                  <div className="h-full flex flex-col gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faded-ink" />
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search captions..." className={`w-full pl-8 pr-3 py-2 rounded-lg border text-xs font-mono transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light text-manuscript focus:border-brass' : 'bg-warm-white border-manuscript-warm text-graphite focus:border-oxblood'}`} />
                    </div>
                    <div className={`flex-1 overflow-y-auto rounded-lg border divide-y ${isDark ? 'border-reading-room-light divide-reading-room-light' : 'border-manuscript-warm divide-manuscript-warm'}`}>
                      {filteredSegments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-faded-ink italic">No matches</div>
                      ) : (
                        filteredSegments.map((seg, idx) => (
                          <div key={idx} className={`p-2.5 flex items-start gap-2.5 text-xs leading-relaxed ${isDark ? 'hover:bg-reading-room-light/50' : 'hover:bg-manuscript-warm/50'}`}>
                            <span className="font-mono text-[10px] font-bold text-brass shrink-0 mt-0.5">
                              {formatTime(seg.start)}
                            </span>
                            <span className={isDark ? 'text-manuscript/80' : 'text-graphite/80'}>{seg.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — Book Reader */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4">
              {/* Toolbar */}
              <div className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border transition-colors ${isDark ? 'bg-reading-room-light border-reading-room-light' : 'bg-warm-white border-manuscript-warm'}`}>
                <div className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-faded-ink" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-faded-ink">Font</span>
                  <div className={`flex p-0.5 rounded-md border ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
                    {(['serif', 'sans', 'mono'] as const).map(style => (
                      <button key={style} onClick={() => setBookStyle(style)} className={`px-2.5 py-0.5 text-[10px] font-medium rounded transition-colors ${bookStyle === style ? (isDark ? 'bg-reading-room text-brass' : 'bg-manuscript-warm text-oxblood') : 'text-faded-ink hover:text-manuscript'}`}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-faded-ink">Size</span>
                  <div className={`flex p-0.5 rounded-md border ${isDark ? 'bg-reading-room border-reading-room-light' : 'bg-manuscript border-manuscript-warm'}`}>
                    {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
                      <button key={size} onClick={() => setFontSize(size)} className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${fontSize === size ? (isDark ? 'bg-reading-room text-brass' : 'bg-manuscript-warm text-oxblood') : 'text-faded-ink hover:text-manuscript'}`}>
                        {size.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Manuscript page */}
              <div className="flex-1 rounded-xl border p-6 sm:p-10 overflow-y-auto bg-manuscript text-graphite min-h-[400px]">
                <article className={`max-w-none text-justify ${bookStyle === 'serif' ? 'font-display' : bookStyle === 'mono' ? 'font-mono' : 'font-ui'} ${fontSize === 'sm' ? 'text-sm' : fontSize === 'base' ? 'text-base' : fontSize === 'lg' ? 'text-lg' : 'text-xl'}`}>
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(formattedChapter, bookStyle) }} />
                </article>
              </div>

              {/* Export bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { onClick: handleCopyText, icon: copyStatus === 'copied_text' ? <Check className="w-3.5 h-3.5 text-oxblood" /> : <Copy className="w-3.5 h-3.5 text-faded-ink" />, label: copyStatus === 'copied_text' ? 'Copied!' : 'Plain Text' },
                  { onClick: handleCopyMarkdown, icon: copyStatus === 'copied_md' ? <Check className="w-3.5 h-3.5 text-oxblood" /> : <FileText className="w-3.5 h-3.5 text-faded-ink" />, label: copyStatus === 'copied_md' ? 'Copied!' : 'Markdown' },
                  { onClick: handleDownloadMarkdown, icon: <Download className="w-3.5 h-3.5 text-faded-ink" />, label: 'Download .md' },
                  { onClick: handlePrintPdf, icon: <Printer className="w-3.5 h-3.5" />, label: 'PDF Print', accent: true },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.onClick} className={`py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${btn.accent ? 'bg-oxblood text-manuscript hover:bg-oxblood-hover active:animate-stamp' : (isDark ? 'bg-reading-room-light text-faded-ink hover:text-manuscript border border-reading-room-light' : 'bg-warm-white text-faded-ink hover:text-graphite border border-manuscript-warm')}`}>
                    {btn.icon}{btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </MouseProvider>
  );
}
