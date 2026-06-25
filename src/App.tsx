import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, Sparkles, Settings, Copy, Download, Check, FileText,
  AlertCircle, Play, Terminal, ChevronRight, Eye, EyeOff, RotateCcw,
  Type, Search, Info, HelpCircle, Clock, Printer, Edit2, ListRestart,
  Video, Wand2
} from "lucide-react";
import { videoPresets } from "./data/presets";
import { extractVideoId, fetchVideoMetadata, fetchTranscript, formatLocalBookChapter, VideoMetadata, TranscriptSegment } from "./utils/transcript";
import { aiProviders, generateBookChapter } from "./utils/ai";
import { parseMarkdownToHtml } from "./utils/markdown";

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem("scribetube_theme");
    return saved === "dark" ? "dark" : "light";
  });
  const [activeTab, setActiveTab] = useState<'presets' | 'editor' | 'help'>('presets');
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
  const [paperTheme, setPaperTheme] = useState<'cream' | 'white' | 'stone' | 'dark'>('cream');
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
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

  const handlePresetSelect = (presetId: string) => {
    const preset = videoPresets[presetId];
    if (!preset) return;
    setError(null); setLogs([]);
    addLog(`Loaded "${preset.title}" — premium curated chapter`);
    setVideoUrl(preset.url);
    setVideoMetadata({ id: preset.id, title: preset.title, channel: preset.channel, thumbnail: preset.thumbnail, url: preset.url });
    setTranscriptSegments(preset.rawTranscript.split("\n\n").map((text, idx) => ({ text: text.trim(), start: idx * 60, duration: 60 })));
    setFormattedChapter(preset.formattedBook);
    setActiveTab('editor');
    setLeftTab('player');
  };

  const handleReset = () => {
    setVideoUrl(""); setVideoMetadata(null); setTranscriptSegments([]); setFormattedChapter("");
    setIsManualInput(false); setManualText(""); setManualTitle(""); setManualChannel("");
    setError(null); setLogs([]); setProgressStep('idle');
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
      setVideoMetadata({ id: "manual-" + Date.now().toString().slice(-4), title, channel, thumbnail: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&q=80&w=600", url: "" });
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
    if (videoPresets[videoId]) { addLog("Recognized preset — loading instantly"); handlePresetSelect(videoId); setIsLoading(false); return; }
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
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono&family=Inter:wght@400;600;700&display=swap');
      body{margin:0;padding:50px;font-family:${bookStyle === 'serif' ? "'Lora', Georgia, serif" : bookStyle === 'mono' ? "'JetBrains Mono', monospace" : "'Inter', sans-serif"};color:#1c1917;background:#fff;line-height:1.625;font-size:16px}
      .book-container{max-width:800px;margin:0 auto}
      h1,h2,h3{font-family:${bookStyle === 'serif' ? "'Playfair Display', serif" : "inherit"};page-break-after:avoid;color:#111827}
      h1{font-size:34px;text-align:center;margin-bottom:10px;font-weight:700;line-height:1.25}
      p.adapt{text-align:center;font-style:italic;color:#6b7280;font-size:14px;margin-top:5px;margin-bottom:40px;border-bottom:1px solid #f3f4f6;padding-bottom:15px}
      h2{font-size:20px;margin-top:45px;margin-bottom:20px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;letter-spacing:.05em;text-transform:uppercase}
      p{margin-bottom:1.5em;text-align:justify}
      blockquote{border-left:3px solid #d97706;padding-left:20px;font-style:italic;margin:30px 0;color:#4b5563}
      ol,ul{margin:20px 0;padding-left:25px}
      li{margin-bottom:10px;text-align:justify}
      pre{background:#f9fafb;border:1px solid #e5e7eb;padding:15px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;margin:25px 0}
      .divider{text-align:center;margin:40px 0;color:#d97706;letter-spacing:.2em;font-size:14px}
      ${bookStyle === 'serif' ? `p.has-dropcap::first-letter{font-size:55px;font-weight:bold;color:#b45309;float:left;line-height:44px;padding-right:10px;padding-top:4px;font-family:'Playfair Display',serif}` : ""}
      @media print{body{padding:15px}@page{size:A4;margin:20mm}h1,h2,h3{page-break-after:avoid}p,li{orphans:3;widows:3}}
    </style>`;
    let html = styledHtml.replace(/<p class="text-lg text-gray-800 dark:text-zinc-200 leading-relaxed font-serif mb-6">\*Adapted from(.*?)<\/p>/, '<p class="adapt">*Adapted from$1</p>').replace(/first-letter:text-5xl/, 'has-dropcap');
    pw.document.write(`<!DOCTYPE html><html><head><title>${videoMetadata.title}</title>${styleTag}</head><body><div class="book-container">${html}</div><script>window.onload=function(){setTimeout(()=>{window.print();window.close()},500)}<\/script></body></html>`);
    pw.document.close();
  };
  const formatTime = (s: number) => { const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`; };
  const filteredSegments = transcriptSegments.filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()));
  const t = (light: string, dark: string) => theme === 'dark' ? dark : light;

  return (
    <div className={`min-h-screen ${t('bg-gradient-to-br from-stone-50 via-stone-50/80 to-amber-50/20', 'bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900')}`}>

      {/* HEADER */}
      <header className={`sticky top-0 z-50 ${t('bg-white/80 border-stone-200/50', 'bg-zinc-950/80 border-zinc-800/50')} backdrop-blur-xl border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleReset}>
            <div className={`${t('bg-gradient-to-br from-amber-500 to-amber-600', 'bg-gradient-to-br from-amber-400 to-amber-500')} p-2.5 rounded-xl shadow-lg shadow-amber-600/20 group-hover:shadow-amber-600/30 group-hover:scale-105 transition-all duration-300`}>
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className={`text-xl font-bold tracking-tight ${t('text-stone-900', 'text-white')}`}>ScribeTube</span>
              <span className={`ml-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${t('bg-amber-100 text-amber-700', 'bg-amber-900/40 text-amber-300')}`}>AI Editor</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavButton active={activeTab === 'help'} onClick={() => setActiveTab(prev => prev === 'help' ? 'presets' : 'help')} icon={<HelpCircle className="w-4 h-4" />} label="Help" theme={theme} />
            <button onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} className={`p-2 rounded-xl transition-all duration-300 ${t('hover:bg-stone-100 text-stone-500', 'hover:bg-zinc-800 text-zinc-400')}`}>
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 11-7.072 0 5 5 0 017.072 0z" /></svg>
              )}
            </button>
            {formattedChapter && (
              <button onClick={() => setActiveTab('editor')} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${t('bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30 hover:scale-105', 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-105')}`}>
                <Sparkles className="w-4 h-4" /> Open Workspace
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* HELP */}
        {activeTab === 'help' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <div className={`p-8 sm:p-10 rounded-3xl border ${t('bg-white border-stone-200 shadow-xl shadow-stone-200/50', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/20')} backdrop-blur-sm`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${t('bg-amber-100 text-amber-600', 'bg-amber-900/30 text-amber-400')}`}><BookOpen className="w-6 h-6" /></div>
                <h2 className={`text-2xl font-bold ${t('text-stone-900', 'text-white')}`}>Welcome to ScribeTube</h2>
              </div>
              <p className={`leading-relaxed mb-8 ${t('text-stone-600', 'text-zinc-300')}`}>
                ScribeTube extracts transcripts from YouTube videos and transforms them into beautifully structured book chapters using AI — or our built-in local formatter. No API key needed for the local mode.
              </p>
              <div className={`grid sm:grid-cols-2 gap-4 mb-8`}>
                {[
                  { icon: <Wand2 className="w-5 h-5" />, title: "Smart Formatting", desc: "Removes filler words, adds headers, smooths prose, generates takeaways" },
                  { icon: <Terminal className="w-5 h-5" />, title: "Local Mode", desc: "Works completely offline with zero API keys" },
                  { icon: <Sparkles className="w-5 h-5" />, title: "AI Enhancement", desc: "Optional Claude, GPT, or Gemini for premium output" },
                  { icon: <Printer className="w-5 h-5" />, title: "Export Anywhere", desc: "Copy, download Markdown, or print beautiful PDFs" },
                ].map((item, i) => (
                  <div key={i} className={`p-4 rounded-2xl border ${t('bg-stone-50/50 border-stone-100', 'bg-zinc-950/50 border-zinc-800/50')}`}>
                    <div className={`${t('text-amber-600', 'text-amber-400')} mb-2`}>{item.icon}</div>
                    <h4 className={`font-semibold text-sm mb-1 ${t('text-stone-900', 'text-white')}`}>{item.title}</h4>
                    <p className={`text-xs ${t('text-stone-500', 'text-zinc-400')}`}>{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className={`p-5 rounded-2xl border ${t('bg-stone-50 border-stone-100', 'bg-zinc-950 border-zinc-800')}`}>
                <h3 className={`font-semibold text-sm mb-3 ${t('text-stone-900', 'text-white')}`}>Manual transcript mode</h3>
                <ol className={`space-y-2 text-xs ${t('text-stone-600', 'text-zinc-400')}`}>
                  {["Open the YouTube video", 'Click "...more" in the description', 'Click "Show transcript"', "Select all text (Cmd+A) and copy", 'Toggle "Paste text manually" in ScribeTube and paste'].map((s, i) => (
                    <li key={i} className="flex items-start gap-2"><span className={`font-bold ${t('text-amber-600', 'text-amber-400')}`}>{i + 1}.</span>{s}</li>
                  ))}
                </ol>
              </div>
              <div className="mt-8 flex justify-center">
                <button onClick={() => setActiveTab('presets')} className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${t('bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30 hover:scale-105', 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-105')}`}>
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        {activeTab !== 'help' && (
          <div className="space-y-8">

            {/* CONFIG + INPUT (shown when no chapter or on presets tab) */}
            {(!formattedChapter || activeTab === 'presets') && (
              <>
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Config */}
                <div className="lg:col-span-5 order-2 lg:order-1">
                  <div className={`p-6 rounded-3xl border ${t('bg-white/80 border-stone-200 shadow-xl shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm h-full`}>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-stone-200 dark:border-zinc-700">
                      <div className={`p-2 rounded-xl ${t('bg-amber-100 text-amber-600', 'bg-amber-900/30 text-amber-400')}`}><Settings className="w-5 h-5" /></div>
                      <div><h3 className={`font-bold ${t('text-stone-900', 'text-white')}`}>Configure</h3><p className={`text-[10px] ${t('text-stone-400', 'text-zinc-500')}`}>AI PROVIDER &amp; KEYS</p></div>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>Provider</label>
                        <select value={provider} onChange={e => setProvider(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 focus:border-amber-400 focus:ring-1 focus:ring-amber-400', 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500')}`}>
                          {aiProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      {provider !== "local" && (
                        <>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${t('text-stone-400', 'text-zinc-500')}`}>API Key</label>
                              <a href={aiProviders.find(p => p.id === provider)?.keyUrl} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-0.5 ${t('text-amber-600 hover:text-amber-700', 'text-amber-400 hover:text-amber-300')}`}>
                                Get key <ChevronRight className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="relative">
                              <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => saveApiKey(e.target.value)} placeholder={aiProviders.find(p => p.id === provider)?.keyPlaceholder} className={`w-full pl-3 pr-10 py-2.5 rounded-xl border text-sm font-mono transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 focus:border-amber-400 focus:ring-1 focus:ring-amber-400', 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500')}`} />
                              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                            </div>
                          </div>
                          <div>
                            <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>Model</label>
                            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 focus:border-amber-400 focus:ring-1 focus:ring-amber-400', 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500')}`}>
                              {aiProviders.find(p => p.id === provider)?.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      {provider === "local" && (
                        <div className={`p-4 rounded-2xl border ${t('bg-gradient-to-br from-amber-50/50 to-amber-100/20 border-amber-200/30', 'bg-gradient-to-br from-amber-950/20 to-amber-900/10 border-amber-900/20')}`}>
                          <p className={`text-xs leading-relaxed ${t('text-stone-600', 'text-zinc-300')}`}>
                            <span className={`font-semibold ${t('text-amber-700', 'text-amber-400')}`}>Local Sandbox Mode</span> — uses a deterministic editing algorithm to filter filler words, restructure text, and generate takeaway notes. Completely free, no API key required.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="lg:col-span-7 order-1 lg:order-2">
                  <div className={`p-6 sm:p-8 rounded-3xl border ${t('bg-white/80 border-stone-200 shadow-xl shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm`}>
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-dashed border-stone-200 dark:border-zinc-700">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${t('bg-amber-100 text-amber-600', 'bg-amber-900/30 text-amber-400')}`}><Video className="w-5 h-5" /></div>
                        <div><h3 className={`font-bold ${t('text-stone-900', 'text-white')}`}>Source Material</h3><p className={`text-[10px] ${t('text-stone-400', 'text-zinc-500')}`}>YOUTUBE URL OR MANUAL PASTE</p></div>
                      </div>
                      <button type="button" onClick={() => setIsManualInput(!isManualInput)} className={`text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-xl border transition-all ${t('border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-amber-600', 'border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400')}`}>
                        <Edit2 className="w-3 h-3" />{isManualInput ? "Use YouTube URL" : "Paste manually"}
                      </button>
                    </div>

                    <form onSubmit={startGeneration} className="space-y-5">
                      {!isManualInput ? (
                        <div>
                          <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>YouTube URL or ID</label>
                          <div className="relative">
                            <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." disabled={isLoading} className={`w-full pl-4 pr-12 py-3 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20', 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20')}`} />
                            {videoUrl && <button type="button" onClick={handleReset} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all"><RotateCcw className="w-4 h-4" /></button>}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>Title</label>
                              <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Steve Jobs' Stanford Speech" className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20', 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20')}`} />
                            </div>
                            <div>
                              <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>Speaker / Creator</label>
                              <input type="text" value={manualChannel} onChange={e => setManualChannel(e.target.value)} placeholder="Steve Jobs" className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20', 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20')}`} />
                            </div>
                          </div>
                          <div>
                            <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${t('text-stone-400', 'text-zinc-500')}`}>Raw Transcript</label>
                            <textarea rows={5} value={manualText} onChange={e => setManualText(e.target.value)} placeholder="Paste raw transcript text here..." className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20', 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20')}`} />
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-fade-in ${t('bg-red-50/80 border-red-200/50', 'bg-red-950/20 border-red-900/30')}`}>
                          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${t('text-red-500', 'text-red-400')}`} />
                          <div>
                            <p className={`text-sm font-semibold ${t('text-red-700', 'text-red-400')}`}>{error}</p>
                            <p className={`text-xs mt-1 ${t('text-stone-500', 'text-zinc-400')}`}>Try pasting the transcript manually using the toggle above.</p>
                          </div>
                        </div>
                      )}

                      <button type="submit" disabled={isLoading} className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${t('bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30 hover:scale-[1.02]', 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-[1.02]')}`}>
                        {isLoading ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Processing...</span></>
                        ) : (
                          <><Sparkles className="w-5 h-5" /><span>Generate Book Chapter</span></>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* PRESETS */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${t('bg-amber-100 text-amber-600', 'bg-amber-900/30 text-amber-400')}`}><BookOpen className="w-5 h-5" /></div>
                  <div><h3 className={`font-bold text-lg ${t('text-stone-900', 'text-white')}`}>Curated Presets</h3><p className={`text-xs ${t('text-stone-400', 'text-zinc-500')}`}>INSTANT CHAPTERS — NO SETUP NEEDED</p></div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Object.values(videoPresets).map((preset) => (
                    <div key={preset.id} onClick={() => handlePresetSelect(preset.id)} className={`group cursor-pointer rounded-3xl overflow-hidden border transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl ${t('bg-white border-stone-200 hover:border-amber-400/50 shadow-lg shadow-stone-200/30', 'bg-zinc-900/70 border-zinc-800 hover:border-amber-500/30 shadow-xl shadow-black/20')}`}>
                      <div className="h-44 relative overflow-hidden">
                        <img src={preset.thumbnail} alt={preset.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <span className={`text-[10px] uppercase tracking-widest font-semibold text-amber-400`}>{preset.channel}</span>
                          <h4 className="text-white font-bold text-sm leading-tight mt-1">{preset.title}</h4>
                        </div>
                        <div className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-110 ${t('bg-white/90 text-amber-600 shadow-lg', 'bg-zinc-900/90 text-amber-400 shadow-lg')}`}>
                          <Play className="w-4 h-4 fill-current stroke-none ml-0.5" />
                        </div>
                      </div>
                      <div className="p-4">
                        <p className={`text-xs leading-relaxed line-clamp-2 ${t('text-stone-500', 'text-zinc-400')}`}>{preset.rawTranscript.slice(0, 140)}...</p>
                        <div className={`flex items-center justify-between mt-3 pt-3 border-t ${t('border-stone-100', 'border-zinc-800')}`}>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${t('text-amber-700', 'text-amber-400')}`}>Curated Chapter</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t('bg-amber-50 text-amber-600 border border-amber-100', 'bg-amber-950/30 text-amber-400 border border-amber-900/30')}`}>Instant</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </>
            )}

            {/* PIPELINE LOGS */}
            {isLoading && (
              <div className={`p-6 sm:p-8 rounded-3xl border max-w-4xl mx-auto animate-fade-in ${t('bg-white/80 border-stone-200 shadow-xl shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                    <span className={`font-bold ${t('text-stone-900', 'text-white')}`}>Editorial Pipeline</span>
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full ${t('bg-stone-100 text-stone-500', 'bg-zinc-950 text-zinc-400')}`}>{progressStep}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { id: 'url', name: 'URL', icon: <Search className="w-3 h-3" /> },
                    { id: 'metadata', name: 'Metadata', icon: <Info className="w-3 h-3" /> },
                    { id: 'captions', name: 'Captions', icon: <FileText className="w-3 h-3" /> },
                    { id: 'ai', name: 'AI Edit', icon: <Sparkles className="w-3 h-3" /> },
                    { id: 'done', name: 'Format', icon: <Check className="w-3 h-3" /> },
                  ].map((step, idx) => {
                    const isCompleted = (progressStep === 'done') || (progressStep === 'ai' && idx < 3) || (progressStep === 'captions' && idx < 2) || (progressStep === 'metadata' && idx < 1);
                    const isActive = progressStep === step.id;
                    return (
                      <div key={step.id} className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all duration-500 ${isCompleted ? t('bg-emerald-50/50 border-emerald-200/50 text-emerald-700', 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400') : isActive ? t('bg-amber-50/50 border-amber-400/50 text-amber-800 scale-105 shadow-lg', 'bg-amber-950/20 border-amber-600/30 text-amber-300 scale-105 shadow-lg') : t('bg-stone-50/50 border-stone-200/50 text-stone-400', 'bg-zinc-950/50 border-zinc-800/50 text-zinc-500')}`}>
                        <div className={`flex items-center justify-center ${isCompleted ? t('bg-emerald-200/50 text-emerald-700', 'bg-emerald-900/30 text-emerald-400') : isActive ? t('bg-amber-200/50 text-amber-800', 'bg-amber-900/30 text-amber-300') : t('bg-stone-200/50', 'bg-zinc-800/50')} w-6 h-6 rounded-lg`}>{step.icon}</div>
                        <span className="text-xs font-semibold">{step.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div className={`flex items-center gap-2 mb-2 ${t('text-stone-400', 'text-zinc-500')}`}>
                    <Terminal className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono font-semibold tracking-widest">LOG</span>
                  </div>
                  <div ref={logContainerRef} className={`h-44 rounded-2xl border p-5 font-mono text-xs overflow-y-auto space-y-2 ${t('bg-stone-950 text-emerald-400 border-stone-800', 'bg-black/80 text-emerald-400 border-zinc-800')}`}>
                    {logs.length === 0 ? (
                      <div className="text-zinc-500 italic animate-pulse">Waiting...</div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed border-l border-emerald-500/20 pl-3">{log}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* WORKSPACE */}
            {formattedChapter && activeTab === 'editor' && (
              <div className="space-y-6 animate-fade-in">
                {videoMetadata && (
                  <div className={`p-4 sm:p-6 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${t('bg-white/80 border-stone-200 shadow-xl shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm`}>
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-16 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                        <img src={videoMetadata.thumbnail} alt={videoMetadata.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[9px] font-bold uppercase tracking-widest ${t('text-amber-600', 'text-amber-400')}`}>{videoMetadata.channel}</div>
                        <h2 className={`font-bold truncate text-sm sm:text-base ${t('text-stone-900', 'text-white')}`}>{videoMetadata.title}</h2>
                      </div>
                    </div>
                    <button onClick={handleReset} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${t('bg-stone-100 text-stone-600 hover:bg-stone-200', 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700')}`}>
                      <ListRestart className="w-3.5 h-3.5" /> New Conversion
                    </button>
                  </div>
                )}

                <div className="grid lg:grid-cols-12 gap-8">
                  {/* LEFT */}
                  <div className="lg:col-span-5">
                    <div className={`rounded-3xl border overflow-hidden h-full ${t('bg-white/80 border-stone-200 shadow-xl shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm`}>
                      <div className={`flex border-b ${t('border-stone-100 bg-stone-50/50', 'border-zinc-800 bg-zinc-950/50')}`}>
                        {[
                          { id: 'player', icon: <Video className="w-4 h-4" />, label: 'Video' },
                          { id: 'transcript', icon: <FileText className="w-4 h-4" />, label: `Captions (${transcriptSegments.length})` },
                        ].map(tab => (
                          <button key={tab.id} onClick={() => setLeftTab(tab.id as any)} className={`flex-1 py-3.5 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${leftTab === tab.id ? t('border-amber-500 text-amber-700 bg-white dark:bg-zinc-900', 'border-amber-500 text-amber-400 bg-zinc-900') : t('border-transparent text-stone-400 hover:text-stone-600', 'border-transparent text-zinc-500 hover:text-zinc-300')}`}>
                            {tab.icon}{tab.label}
                          </button>
                        ))}
                      </div>
                      <div className="p-4 h-[500px]">
                        {leftTab === 'player' ? (
                          videoMetadata && videoMetadata.id && !videoMetadata.id.startsWith("manual-") ? (
                            <div className="h-full flex flex-col gap-4">
                              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoMetadata.id}`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                              </div>
                              <div className={`flex-1 p-4 rounded-2xl border text-xs leading-relaxed overflow-y-auto ${t('bg-stone-50/50 border-stone-100 text-stone-500', 'bg-zinc-950/50 border-zinc-800/50 text-zinc-400')}`}>
                                <p className={`font-semibold mb-2 ${t('text-stone-800', 'text-zinc-200')}`}>Workspace</p>
                                <p>Watch alongside your formatted chapter. Use the transcript tab for timestamped cross-referencing.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                              <FileText className={`w-14 h-14 mb-4 ${t('text-stone-300', 'text-zinc-700')}`} />
                              <h4 className={`font-bold mb-2 ${t('text-stone-800', 'text-zinc-200')}`}>Manual Entry</h4>
                              <p className={`text-xs max-w-xs ${t('text-stone-500', 'text-zinc-400')}`}>No video embed available for manually entered transcripts. Switch to the captions tab.</p>
                            </div>
                          )
                        ) : (
                          <div className="h-full flex flex-col gap-3">
                            <div className="relative">
                              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${t('text-stone-400', 'text-zinc-500')}`} />
                              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search captions..." className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs transition-all ${t('bg-stone-50 border-stone-200 text-stone-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20', 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20')}`} />
                            </div>
                            <div className={`flex-1 overflow-y-auto rounded-2xl border divide-y ${t('border-stone-100 divide-stone-100 bg-stone-50/30', 'border-zinc-800 divide-zinc-800 bg-zinc-950/30')}`}>
                              {filteredSegments.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400 dark:text-zinc-500 italic">No matches</div>
                              ) : (
                                filteredSegments.map((seg, idx) => (
                                  <div key={idx} className={`p-3 flex items-start gap-3 text-xs leading-relaxed transition-colors ${t('hover:bg-stone-100/50', 'hover:bg-zinc-900/50')}`}>
                                    <span className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${t('bg-stone-200 text-stone-500', 'bg-zinc-800 text-zinc-400')}`}>
                                      <Clock className="w-3 h-3" />{formatTime(seg.start)}
                                    </span>
                                    <span className={t('text-stone-700', 'text-zinc-300')}>{seg.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${t('bg-white/80 border-stone-200 shadow-lg shadow-stone-200/20', 'bg-zinc-900/70 border-zinc-800 shadow-xl shadow-black/10')} backdrop-blur-sm`}>
                      <div className="flex items-center gap-2">
                        <Type className={`w-4 h-4 ${t('text-stone-400', 'text-zinc-500')}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${t('text-stone-400', 'text-zinc-500')}`}>Font</span>
                        <div className={`flex p-0.5 rounded-xl border ${t('bg-stone-100 border-stone-200', 'bg-zinc-950 border-zinc-800')}`}>
                          {(['serif', 'sans', 'mono'] as const).map(style => (
                            <button key={style} onClick={() => setBookStyle(style)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${bookStyle === style ? t('bg-white text-stone-900 shadow-sm', 'bg-zinc-800 text-white shadow-sm') : t('text-stone-400 hover:text-stone-600', 'text-zinc-500 hover:text-zinc-300')}`}>
                              {style.charAt(0).toUpperCase() + style.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${t('text-stone-400', 'text-zinc-500')}`}>Size</span>
                        <div className={`flex p-0.5 rounded-xl border ${t('bg-stone-100 border-stone-200', 'bg-zinc-950 border-zinc-800')}`}>
                          {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
                            <button key={size} onClick={() => setFontSize(size)} className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${fontSize === size ? t('bg-white text-stone-900 shadow-sm', 'bg-zinc-800 text-white shadow-sm') : t('text-stone-400 hover:text-stone-600', 'text-zinc-500 hover:text-zinc-300')}`}>
                              {size.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest mr-1 ${t('text-stone-400', 'text-zinc-500')}`}>Paper</span>
                        {[
                          { id: 'cream', c: 'bg-[#faf6f0] border-amber-200/40' },
                          { id: 'white', c: 'bg-white border-stone-200' },
                          { id: 'stone', c: 'bg-[#f4f3f0] border-stone-300' },
                          { id: 'dark', c: 'bg-zinc-800 border-zinc-700' },
                        ].map(p => (
                          <button key={p.id} onClick={() => setPaperTheme(p.id as any)} className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${p.c} ${paperTheme === p.id ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-zinc-900 scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`} title={p.id} />
                        ))}
                      </div>
                    </div>

                    {/* BOOK READER */}
                    <div className={`rounded-3xl border transition-all duration-500 p-8 sm:p-12 h-[500px] overflow-y-auto ${
                      paperTheme === 'cream' ? 'bg-[#faf6f0] border-amber-100/50 text-stone-800 shadow-2xl shadow-amber-900/5' :
                      paperTheme === 'white' ? 'bg-white border-stone-200/50 text-stone-900 shadow-xl' :
                      paperTheme === 'stone' ? 'bg-[#f4f3f0] border-stone-200/50 text-stone-800 shadow-xl' :
                      'bg-zinc-900 border-zinc-800/50 text-zinc-200 shadow-2xl shadow-black/20'
                    }`}>
                      <article className={`prose max-w-none focus:outline-none text-justify ${bookStyle === 'serif' ? 'font-serif-book' : bookStyle === 'mono' ? 'font-mono-book' : 'font-sans-book'} ${fontSize === 'sm' ? 'text-sm' : fontSize === 'base' ? 'text-base' : fontSize === 'lg' ? 'text-lg' : 'text-xl'}`}>
                        <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(formattedChapter, bookStyle) }} />
                      </article>
                    </div>

                    {/* EXPORT */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { onClick: handleCopyText, icon: copyStatus === 'copied_text' ? <Check className={`w-4 h-4 text-emerald-500`} /> : <Copy className={`w-4 h-4 ${t('text-stone-400', 'text-zinc-500')}`} />, label: copyStatus === 'copied_text' ? 'Copied!' : 'Plain Text', active: copyStatus === 'copied_text' },
                        { onClick: handleCopyMarkdown, icon: copyStatus === 'copied_md' ? <Check className={`w-4 h-4 text-emerald-500`} /> : <FileText className={`w-4 h-4 ${t('text-stone-400', 'text-zinc-500')}`} />, label: copyStatus === 'copied_md' ? 'Copied!' : 'Markdown', active: copyStatus === 'copied_md' },
                        { onClick: handleDownloadMarkdown, icon: <Download className={`w-4 h-4 ${t('text-stone-400', 'text-zinc-500')}`} />, label: 'Download .md', active: false },
                        { onClick: handlePrintPdf, icon: <Printer className="w-4 h-4" />, label: 'PDF Print', accent: true, active: false },
                      ].map((btn, i) => (
                        <button key={i} onClick={btn.onClick} className={`px-3 py-3 rounded-2xl text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${btn.accent ? t('bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30 hover:scale-105', 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30 hover:scale-105') : btn.active ? t('bg-emerald-50 text-emerald-600 border border-emerald-200', 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30') : t('bg-stone-100/80 text-stone-600 hover:bg-stone-200/80 border border-stone-200/50', 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800/80 border border-zinc-800/50')}`}>
                          {btn.icon}{btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      <footer className={`mt-20 py-10 text-center border-t ${t('border-stone-200/50 bg-stone-50/30 text-stone-400', 'border-zinc-800/50 bg-zinc-950/30 text-zinc-500')}`}>
        <p className={`text-sm italic mb-1 ${t('text-stone-500', 'text-zinc-400')}`}>Stay Hungry. Stay Foolish.</p>
        <p className="text-xs opacity-60">&copy; 2026 ScribeTube · Client-side parsing &amp; formatting</p>
      </footer>

    </div>
  );
}

function NavButton({ active, onClick, icon, theme }: { active: boolean; onClick: () => void; icon: React.ReactNode; theme: string; label?: string }) {
  const t = (light: string, dark: string) => theme === 'dark' ? dark : light;
  return (
    <button onClick={onClick} className={`p-2 rounded-xl transition-all duration-300 ${active ? t('bg-amber-50 text-amber-700 shadow-sm', 'bg-amber-950/40 text-amber-400 shadow-sm') : t('hover:bg-stone-100 text-stone-500', 'hover:bg-zinc-800 text-zinc-400')}`}>
      {icon}
    </button>
  );
}
