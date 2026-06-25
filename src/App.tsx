import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Sparkles, 
  Settings, 
  Copy, 
  Download, 
  Check, 
  FileText, 
  AlertCircle, 
  Play, 
  Terminal, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Type, 
  Search, 
  Info, 
  HelpCircle,
  Clock,
  Printer,
  Edit2,
  ListRestart
} from "lucide-react";
import { videoPresets } from "./data/presets";
import { extractVideoId, fetchVideoMetadata, fetchTranscript, formatLocalBookChapter, VideoMetadata, TranscriptSegment } from "./utils/transcript";
import { aiProviders, generateBookChapter } from "./utils/ai";
import { parseMarkdownToHtml } from "./utils/markdown";

export default function App() {
  // Theme & Layout
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem("scribetube_theme");
    return saved === "dark" ? "dark" : "light";
  });
  
  // App Navigation / Workspace state
  const [activeTab, setActiveTab] = useState<'presets' | 'editor' | 'help'>('presets');
  const [videoUrl, setVideoUrl] = useState("");
  
  // API Configurations
  const [provider, setProvider] = useState(() => {
    return localStorage.getItem("scribetube_provider") || "local";
  });
  const [apiKey, setApiKey] = useState(() => {
    const p = localStorage.getItem("scribetube_provider") || "local";
    return localStorage.getItem(`scribetube_${p}_key`) || "";
  });
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");

  // Book formatting preferences
  const [bookStyle, setBookStyle] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [paperTheme, setPaperTheme] = useState<'cream' | 'white' | 'stone' | 'dark'>('cream');

  // Interactive workspaces data
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [formattedChapter, setFormattedChapter] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftTab, setLeftTab] = useState<'player' | 'transcript'>('player');

  // Manual Transcript entry fallback
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualChannel, setManualChannel] = useState("");
  const [manualText, setManualText] = useState("");

  // Loading, progress & terminal logs state
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<'idle' | 'url' | 'metadata' | 'captions' | 'ai' | 'done'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Status badges for operations
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied_text' | 'copied_md'>('idle');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Sync theme to document body
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("scribetube_theme", theme);
  }, [theme]);

  // Sync API key changes
  useEffect(() => {
    localStorage.setItem("scribetube_provider", provider);
    const savedKey = localStorage.getItem(`scribetube_${provider}_key`) || "";
    setApiKey(savedKey);
    
    // Auto-select default model for provider
    const provConfig = aiProviders.find(p => p.id === provider);
    if (provConfig) {
      setSelectedModel(provConfig.defaultModel);
    }
  }, [provider]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(`scribetube_${provider}_key`, key);
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = videoPresets[presetId];
    if (!preset) return;

    setError(null);
    setLogs([]);
    addLog(`Selected famous preset: "${preset.title}"`);
    addLog(`Skipping scraping & AI computation. Instantly loaded curated chapter.`);
    
    setVideoUrl(preset.url);
    setVideoMetadata({
      id: preset.id,
      title: preset.title,
      channel: preset.channel,
      thumbnail: preset.thumbnail,
      url: preset.url
    });
    setTranscriptSegments(
      preset.rawTranscript.split("\n\n").map((text, idx) => ({
        text: text.trim(),
        start: idx * 60,
        duration: 60
      }))
    );
    setFormattedChapter(preset.formattedBook);
    setActiveTab('editor');
    setLeftTab('player');
  };

  const handleReset = () => {
    setVideoUrl("");
    setVideoMetadata(null);
    setTranscriptSegments([]);
    setFormattedChapter("");
    setIsManualInput(false);
    setManualText("");
    setManualTitle("");
    setManualChannel("");
    setError(null);
    setLogs([]);
    setProgressStep('idle');
  };

  const startGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLogs([]);
    setIsLoading(true);

    if (isManualInput) {
      await runManualWorkflow();
    } else {
      await runScrapingWorkflow();
    }
  };

  const runManualWorkflow = async () => {
    if (!manualTitle.trim()) {
      setError("Please specify a chapter or video title.");
      setIsLoading(false);
      return;
    }
    if (!manualText.trim()) {
      setError("Please paste the raw transcript text.");
      setIsLoading(false);
      return;
    }

    try {
      setProgressStep('metadata');
      addLog("Initializing Manual Transcript Processing...");
      const title = manualTitle.trim();
      const channel = manualChannel.trim() || "Independent Creator";
      
      const mockMeta: VideoMetadata = {
        id: "manual-" + Date.now().toString().slice(-4),
        title: title,
        channel: channel,
        thumbnail: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&q=80&w=600",
        url: ""
      };
      setVideoMetadata(mockMeta);
      addLog(`Created metadata card for chapter: "${title}"`);

      setProgressStep('captions');
      addLog(`Loaded raw text (${manualText.split(/\s+/).length} words).`);
      setTranscriptSegments(
        manualText.split(/\n+/).map((p, idx) => ({
          text: p,
          start: idx * 30,
          duration: 30
        }))
      );

      // AI transformation step
      setProgressStep('ai');
      await executeAiFormatting(title, channel, manualText);
      
      setProgressStep('done');
      addLog("Generation successfully completed!");
      setActiveTab('editor');
      setLeftTab('transcript');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during manual formatting.");
      addLog(`[ERROR] ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runScrapingWorkflow = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      setError("Invalid YouTube URL. Please enter a valid watch link, sharing link, or 11-digit video ID.");
      setIsLoading(false);
      return;
    }

    // Check if the URL is one of our pre-configured presets for instant loading
    if (videoPresets[videoId]) {
      addLog("Recognized video preset. Loading premium pre-formatted edition instantly.");
      handlePresetSelect(videoId);
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Parse and validate
      setProgressStep('url');
      addLog(`Extracting Video ID from URL...`);
      addLog(`Detected YouTube Video ID: ${videoId}`);

      // Step 2: Fetch metadata
      setProgressStep('metadata');
      addLog("Querying YouTube video details via oEmbed server...");
      const meta = await fetchVideoMetadata(videoId);
      setVideoMetadata(meta);
      addLog(`Metadata Received! Title: "${meta.title}" | Channel: ${meta.channel}`);

      // Step 3: Extract captions
      setProgressStep('captions');
      addLog("Fetching captions via local Python backend...");
      
      const fetched = await fetchTranscript(videoId);
      addLog(`Extracted ${fetched.segments.length} timestamped caption segments.`);
      addLog(`Raw word count: ${fetched.rawText.split(/\s+/).length} words.`);
      setTranscriptSegments(fetched.segments);

      // Step 4: AI Editor chapter writing
      setProgressStep('ai');
      await executeAiFormatting(meta.title, meta.channel, fetched.rawText);

      setProgressStep('done');
      addLog("Book chapter generation successfully completed!");
      setActiveTab('editor');
      setLeftTab('player');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while fetching the YouTube transcript.");
      addLog(`[ERROR] ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAiFormatting = async (title: string, channel: string, text: string) => {
    if (provider === "local") {
      addLog("Invoking Local Smart Heuristic Editor (No API key required)...");
      addLog("Applying advanced editorial heuristics: filtering fillers, chunking text, generating outlines...");
      // Simulate slight processing latency for premium feel
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = formatLocalBookChapter(title, channel, text);
      setFormattedChapter(result);
      addLog("Local Smart Editor successfully structured the transcript.");
    } else {
      addLog(`Preparing request to ${aiProviders.find(p => p.id === provider)?.name}...`);
      addLog(`Selected Model: ${selectedModel}`);
      addLog("Applying professional editing guidelines via system prompt...");
      addLog("Sending payload through secure corsproxy.io wrapper...");
      
      try {
        const result = await generateBookChapter(provider, apiKey, selectedModel, title, channel, text);
        setFormattedChapter(result);
        addLog("AI Editor finished writing! Received fully structured chapter.");
      } catch (aiError: any) {
        addLog(`[AI ERROR] ${aiError.message}`);
        addLog("Falling back to Local Smart Heuristic Editor to guarantee chapter generation...");
        const fallbackResult = formatLocalBookChapter(title, channel, text);
        setFormattedChapter(fallbackResult);
        addLog("Local Smart Editor successfully structured your chapter as a fallback.");
      }
    }
  };

  // Clipboard Copiers
  const handleCopyText = () => {
    // Strip markdown formatting symbols for plain text
    const cleanText = formattedChapter
      .replace(/[#*`>_-]/g, "")
      .replace(/\n{3,}/g, "\n\n");
    navigator.clipboard.writeText(cleanText);
    setCopyStatus('copied_text');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(formattedChapter);
    setCopyStatus('copied_md');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  // Download Markdown File
  const handleDownloadMarkdown = () => {
    if (!videoMetadata) return;
    const blob = new Blob([formattedChapter], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const sanitizedTitle = videoMetadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `chapter-${sanitizedTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print/Download PDF
  const handlePrintPdf = () => {
    if (!videoMetadata || !formattedChapter) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to compile and print the book chapter PDF.");
      return;
    }
    
    const styledHtml = parseMarkdownToHtml(formattedChapter, bookStyle);
    
    const styleTag = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono&family=Inter:wght@400;600;700&display=swap');
        
        body {
          margin: 0;
          padding: 50px;
          font-family: ${bookStyle === 'serif' ? "'Lora', Georgia, serif" : bookStyle === 'mono' ? "'JetBrains Mono', monospace" : "'Inter', sans-serif"};
          color: #1c1917;
          background-color: #ffffff;
          line-height: 1.625;
          font-size: 16px;
        }
        
        .book-container {
          max-width: 800px;
          margin: 0 auto;
        }
        
        h1, h2, h3 {
          font-family: ${bookStyle === 'serif' ? "'Playfair Display', serif" : "inherit"};
          page-break-after: avoid;
          color: #111827;
        }
        
        h1 {
          font-size: 34px;
          text-align: center;
          margin-bottom: 10px;
          font-weight: 700;
          line-height: 1.25;
        }
        
        p.adapt {
          text-align: center;
          font-style: italic;
          color: #6b7280;
          font-size: 14px;
          margin-top: 5px;
          margin-bottom: 40px;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 15px;
        }
        
        h2 {
          font-size: 20px;
          margin-top: 45px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        
        p {
          margin-bottom: 1.5em;
          text-align: justify;
        }
        
        blockquote {
          border-left: 3px solid #d97706;
          padding-left: 20px;
          font-style: italic;
          margin: 30px 0;
          color: #4b5563;
        }
        
        ol, ul {
          margin: 20px 0;
          padding-left: 25px;
        }
        
        li {
          margin-bottom: 10px;
          text-align: justify;
        }
        
        pre {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 15px;
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          white-space: pre-wrap;
          margin: 25px 0;
        }
        
        .divider {
          text-align: center;
          margin: 40px 0;
          color: #d97706;
          letter-spacing: 0.2em;
          font-size: 14px;
        }

        /* Drop cap styling */
        ${bookStyle === 'serif' ? `
          p.has-dropcap::first-letter {
            font-size: 55px;
            font-weight: bold;
            color: #b45309;
            float: left;
            line-height: 44px;
            padding-right: 10px;
            padding-top: 4px;
            font-family: 'Playfair Display', serif;
          }
        ` : ""}
        
        @media print {
          body {
            padding: 15px;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
          h1, h2, h3 {
            page-break-after: avoid;
          }
          p, li {
            orphans: 3;
            widows: 3;
          }
        }
      </style>
    `;

    // Process output XML formatting slightly for beautiful print compatibility
    let printableHtml = styledHtml;
    // Add adaptation class to adapt text
    printableHtml = printableHtml.replace(/<p class="text-lg text-gray-800 dark:text-zinc-200 leading-relaxed font-serif mb-6">\*Adapted from(.*?)<\/p>/, '<p class="adapt">*Adapted from$1</p>');
    // Inject custom class for drop-cap
    printableHtml = printableHtml.replace(/first-letter:text-5xl/, 'has-dropcap');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${videoMetadata.title} - Formatted Chapter</title>
          ${styleTag}
        </head>
        <body>
          <div class="book-container">
            ${printableHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper lists for interactive timestamps
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredSegments = transcriptSegments.filter(s => 
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      theme === 'dark' ? 'bg-zinc-950 text-zinc-50' : 'bg-stone-50 text-stone-900'
    }`}>
      
      {/* Header Bar */}
      <header className={`border-b ${
        theme === 'dark' ? 'border-zinc-800 bg-zinc-900/60' : 'border-stone-200 bg-white/70'
      } sticky top-0 z-40 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={handleReset}>
            <div className="bg-amber-600 dark:bg-amber-500 text-white p-2.5 rounded-xl shadow-md shadow-amber-600/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold font-serif-display tracking-tight text-stone-900 dark:text-zinc-50">
                ScribeTube
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-sans tracking-wide uppercase px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-900/40">
                AI Editor
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab(prev => prev === 'help' ? 'presets' : 'help')}
              className={`p-2 rounded-lg border transition-all ${
                activeTab === 'help'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400'
                  : 'border-transparent text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
              title="How it Works"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg border border-transparent text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              title="Toggle Light/Dark"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 11-7.072 0 5 5 0 017.072 0z" /></svg>
              )}
            </button>

            {formattedChapter && (
              <button
                onClick={() => setActiveTab('editor')}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Active Book Workspace</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Help Screen Tab */}
        {activeTab === 'help' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className={`p-8 rounded-2xl border ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
            }`}>
              <h2 className="text-2xl font-serif-display font-bold mb-4 flex items-center gap-2">
                <BookOpen className="text-amber-600 dark:text-amber-500" />
                Welcome to ScribeTube AI
              </h2>
              <p className="text-stone-600 dark:text-zinc-300 leading-relaxed mb-6">
                ScribeTube parses manual and automatically-generated captions directly from public YouTube videos, bypassing corporate firewalls and geographic blocks. It then forwards the text stream to state-of-the-art Large Language Models (including Claude 3.5 Sonnet) using a custom system prompt to re-structure and polish it into an elegant, highly structured book chapter.
              </p>

              <h3 className="text-lg font-bold font-serif-display mb-3 text-amber-600 dark:text-amber-500">
                Our Editorial Standards
              </h3>
              <ul className="space-y-3 mb-6 text-stone-600 dark:text-zinc-300 pl-5 list-disc">
                <li><strong>Removal of filler jargon:</strong> Removes verbal tics ("like", "you know", "basically").</li>
                <li><strong>Prose formatting:</strong> Smooths out broken starts, transitions, and repetitions.</li>
                <li><strong>Outlines & Subheaders:</strong> Groups core topics logically under academic headers.</li>
                <li><strong>Preserving Information:</strong> Every fact, detail, and idea is strictly maintained.</li>
                <li><strong>Takeaway Summaries:</strong> Synthesizes core learning points in an endnote layout.</li>
              </ul>

              <h3 className="text-lg font-bold font-serif-display mb-3">
                How to copy transcripts manually if automated extraction fails:
              </h3>
              <p className="text-stone-600 dark:text-zinc-300 leading-relaxed mb-4">
                Occasionally, YouTube blocks scraping servers or restricts specific videos (e.g., age-restricted or country-blocked content). For these edge cases, ScribeTube includes a <strong>Manual Transcript Mode</strong> so you can still generate chapters!
              </p>
              <div className="bg-stone-100 dark:bg-zinc-950 p-4 rounded-xl space-y-2 border border-stone-200 dark:border-zinc-800 font-sans text-sm text-stone-600 dark:text-zinc-400">
                <p>1. Open the YouTube video in your browser.</p>
                <p>2. Click the <strong className="text-stone-900 dark:text-zinc-100">"...more"</strong> section inside the description.</p>
                <p>3. Scroll down and click the <strong className="text-stone-900 dark:text-zinc-100">"Show transcript"</strong> button to open the captions sidebar.</p>
                <p>4. Select all text (Ctrl+A / Cmd+A) inside that sidebar and copy it.</p>
                <p>5. Toggle the <strong className="text-stone-900 dark:text-zinc-100">"Paste transcript manually"</strong> option in ScribeTube and paste the text!</p>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setActiveTab('presets')}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                >
                  Get Started Now
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'help' && (
          <div className="space-y-8">
            
            {/* Top Config & Input Segment */}
            {(!formattedChapter || activeTab === 'presets') && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Configuration Panel Column */}
                <div className="lg:col-span-5 space-y-6">
                  <div className={`p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
                  }`}>
                    <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-stone-100 dark:border-zinc-800">
                      <Settings className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      <h3 className="font-serif-display font-bold text-lg">
                        1. Configure AI Editor
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                          AI Provider
                        </label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 font-sans focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          {aiProviders.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {provider !== "local" && (
                        <>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                {aiProviders.find(p => p.id === provider)?.name} API Key
                              </label>
                              <a 
                                href={aiProviders.find(p => p.id === provider)?.keyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-amber-600 hover:underline flex items-center"
                              >
                                Get API Key <ChevronRight className="w-3 h-3 ml-0.5" />
                              </a>
                            </div>
                            <div className="relative">
                              <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => saveApiKey(e.target.value)}
                                placeholder={aiProviders.find(p => p.id === provider)?.keyPlaceholder}
                                className="w-full pl-3 pr-10 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                              >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400 flex items-start gap-1">
                              <Info className="w-3.5 h-3.5 text-amber-600/70 inline shrink-0 mt-0.5" />
                              <span>Keys are securely saved <strong>locally</strong> in your browser and are never sent to any third-party analytics servers.</span>
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                              Selected Model
                            </label>
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 font-sans focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              {aiProviders.find(p => p.id === provider)?.models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {provider === "local" && (
                        <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 rounded-xl">
                          <p className="text-xs text-stone-600 dark:text-zinc-300 leading-relaxed">
                            <strong>Local Sandbox Mode</strong> utilizes a local deterministic editing algorithm to filter repetition, restructure texts, layout markdown titles and headers, and generate takeaway notes completely free on your CPU. Great for testing custom URLs without keys!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Panel Column */}
                <div className="lg:col-span-7 space-y-6">
                  <div className={`p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
                  }`}>
                    
                     <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100 dark:border-zinc-800">
                      <div className="flex items-center space-x-2.5">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.871.51 9.388.51 9.388.51s7.517 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        <h3 className="font-serif-display font-bold text-lg">
                          2. Input Source Material
                        </h3>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsManualInput(!isManualInput)}
                        className="text-xs text-amber-600 dark:text-amber-500 font-medium hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {isManualInput ? "Fetch from YouTube URL" : "Paste raw text manually"}
                      </button>
                    </div>

                    <form onSubmit={startGeneration} className="space-y-4">
                      
                      {!isManualInput ? (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                            YouTube Video URL or ID
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={videoUrl}
                              onChange={(e) => setVideoUrl(e.target.value)}
                              placeholder="e.g., https://www.youtube.com/watch?v=UF8uR6Z6KLc"
                              disabled={isLoading}
                              className="w-full pl-3 pr-12 py-2.5 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            {videoUrl && (
                              <button
                                type="button"
                                onClick={handleReset}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                                Chapter / Video Title
                              </label>
                              <input
                                type="text"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                                placeholder="Steve Jobs' Stanford Speech"
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                                Original Creator / Speaker
                              </label>
                              <input
                                type="text"
                                value={manualChannel}
                                onChange={(e) => setManualChannel(e.target.value)}
                                placeholder="Steve Jobs"
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-stone-500 dark:text-zinc-400">
                              Paste Raw Transcript Text
                            </label>
                            <textarea
                              rows={5}
                              value={manualText}
                              onChange={(e) => setManualText(e.target.value)}
                              placeholder="Paste raw transcript captions or speaker block here..."
                              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-sans"
                            />
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/40 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-semibold">Formatting Error: </strong>
                            {error}
                            <p className="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">
                              Tip: If YouTube's transcript servers are blocking requests, please copy-paste the transcript manually via description bar using the "Paste raw text manually" link above.
                            </p>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shadow-md shadow-amber-600/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-5 h-5 animate-pulse" />
                        <span>{isLoading ? "Running Editorial Pipeline..." : "Fetch Transcript & Generate Book Chapter"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Video Preset chips */}
            {(!formattedChapter || activeTab === 'presets') && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  <h3 className="font-serif-display font-bold text-lg">
                    Or Instantly Explore Curated Speech Speeches (Sandbox Mode)
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.values(videoPresets).map((preset) => (
                    <div 
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] ${
                        theme === 'dark' 
                          ? 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50' 
                          : 'bg-white border-stone-200 hover:border-amber-600/50 shadow-sm'
                      }`}
                    >
                      <div className="h-40 relative overflow-hidden bg-stone-200 dark:bg-zinc-800">
                        <img 
                          src={preset.thumbnail} 
                          alt={preset.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 to-stone-900/25 flex flex-col justify-end p-4">
                          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                            {preset.channel}
                          </span>
                          <h4 className="text-white font-serif-display font-bold text-sm line-clamp-2">
                            {preset.title}
                          </h4>
                        </div>
                        <div className="absolute top-3 right-3 bg-stone-900/80 backdrop-blur-md text-amber-400 p-1.5 rounded-full border border-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 fill-amber-400 stroke-none" />
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-xs text-stone-500 dark:text-zinc-400 line-clamp-3">
                          {preset.rawTranscript.slice(0, 160)}...
                        </p>
                        <div className="flex items-center justify-between pt-2 text-[11px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">
                          <span>Curated Book Chapter</span>
                          <span className="bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30">
                            Instant Load
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pipeline logs console */}
            {isLoading && (
              <div className={`p-6 rounded-2xl border ${
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
              } space-y-5 max-w-4xl mx-auto`}>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="font-serif-display font-bold text-lg">
                      ScribeTube Editorial Pipeline
                    </span>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-wider px-2 py-1 bg-stone-100 dark:bg-zinc-950 rounded border dark:border-zinc-800 text-stone-500 dark:text-zinc-400">
                    Step: {progressStep.toUpperCase()}
                  </span>
                </div>

                {/* Animated Pipeline Steps */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  {[
                    { id: 'url', name: 'Validate URL' },
                    { id: 'metadata', name: 'Video Metadata' },
                    { id: 'captions', name: 'Fetch Captions' },
                    { id: 'ai', name: 'AI Claude Editor' },
                    { id: 'done', name: 'Format Book' },
                  ].map((step, idx) => {
                    const isCompleted = 
                      (progressStep === 'done') ||
                      (progressStep === 'ai' && idx < 3) ||
                      (progressStep === 'captions' && idx < 2) ||
                      (progressStep === 'metadata' && idx < 1);
                    const isActive = progressStep === step.id;
                    
                    return (
                      <div 
                        key={step.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isCompleted
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/20 text-emerald-800 dark:text-emerald-400'
                            : isActive
                              ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-500 dark:border-amber-600/30 text-amber-900 dark:text-amber-400 font-bold scale-[1.02]'
                              : 'bg-stone-50 dark:bg-zinc-950/50 border-stone-200 dark:border-zinc-800/40 text-stone-400 dark:text-zinc-500'
                        }`}
                      >
                        <span className="text-[10px] font-semibold opacity-60">Step 0{idx + 1}</span>
                        <span className="font-medium truncate">{step.name}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Interactive log terminal */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs text-stone-500 dark:text-zinc-400 font-mono">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>TECHNICAL COMPILE TRACE</span>
                  </div>
                  <div 
                    ref={logContainerRef}
                    className="h-44 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-950 text-emerald-500 p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-inner"
                  >
                    {logs.length === 0 ? (
                      <div className="text-zinc-500 italic animate-pulse">Waiting for pipeline instructions...</div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed border-l border-emerald-500/20 pl-2">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SPLIT INTERACTIVE WORKSPACE */}
            {formattedChapter && activeTab === 'editor' && (
              <div className="space-y-6">
                
                {/* Book Workspace Control Card */}
                {videoMetadata && (
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
                  }`}>
                    <div className="flex items-center space-x-3.5 w-full">
                      <div className="w-14 h-10 rounded overflow-hidden bg-stone-200 shrink-0">
                        <img src={videoMetadata.thumbnail} alt={videoMetadata.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest leading-none">
                          {videoMetadata.channel}
                        </div>
                        <h2 className="font-serif-display font-bold text-stone-900 dark:text-zinc-100 text-sm sm:text-base truncate">
                          {videoMetadata.title}
                        </h2>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 text-xs bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors text-stone-600 dark:text-zinc-300 flex items-center gap-1.5 shrink-0"
                    >
                      <ListRestart className="w-3.5 h-3.5" />
                      <span>Convert Another Video</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* LEFT COLUMN: Source Materials */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className={`rounded-2xl border overflow-hidden ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
                    }`}>
                      {/* Left Tab Switcher */}
                      <div className="flex border-b border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50">
                        <button
                          onClick={() => setLeftTab('player')}
                          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                            leftTab === 'player'
                              ? 'border-amber-600 text-amber-700 dark:border-amber-500 dark:text-amber-400 bg-white dark:bg-zinc-900'
                              : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.871.51 9.388.51 9.388.51s7.517 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          <span>YouTube Source</span>
                        </button>
                        <button
                          onClick={() => setLeftTab('transcript')}
                          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                            leftTab === 'transcript'
                              ? 'border-amber-600 text-amber-700 dark:border-amber-500 dark:text-amber-400 bg-white dark:bg-zinc-900'
                              : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                          <span>Raw Captions ({transcriptSegments.length})</span>
                        </button>
                      </div>

                      {/* Content panel */}
                      <div className="p-4 h-[550px]">
                        
                        {/* Tab A: YouTube Player Frame */}
                        {leftTab === 'player' && (
                          <div className="h-full flex flex-col justify-between">
                            {videoMetadata && videoMetadata.id && !videoMetadata.id.startsWith("manual-") ? (
                              <div className="space-y-4 h-full flex flex-col">
                                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-stone-100 dark:border-zinc-800 shadow-sm">
                                  <iframe
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${videoMetadata.id}`}
                                    title="YouTube Video Player"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                                <div className="flex-1 bg-stone-50 dark:bg-zinc-950 p-4 rounded-xl border border-stone-100 dark:border-zinc-800/40 text-xs text-stone-600 dark:text-zinc-400 leading-relaxed overflow-y-auto space-y-2.5">
                                  <p className="font-bold text-stone-900 dark:text-zinc-100">Video Integration Workspace</p>
                                  <p>Watch and listen to the lecture or speech side-by-side with your customized formatted book chapter! Use timestamps in the adjacent "Raw Captions" tab to cross-examine specific citations, metrics, or core narratives.</p>
                                  <div className="h-[1px] bg-stone-200 dark:bg-zinc-800 my-2" />
                                  <p className="text-[11px] italic">You can change reading parameters in the right panel—such as shifting from serif typography to technical monospace, increasing spacing, or altering contrast grids to suit your study environment.</p>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500 dark:text-zinc-400 space-y-3">
                                <FileText className="w-12 h-12 text-stone-300 dark:text-zinc-700 animate-pulse" />
                                <h4 className="font-serif-display font-bold text-stone-800 dark:text-zinc-200">Manual Material Workspace</h4>
                                <p className="text-xs max-w-xs">
                                  Since this chapter was generated using Manual Text Input rather than a video link, there is no corresponding YouTube embed player. Use the "Raw Captions" tab above to explore your source material.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab B: Raw Captions timestamp browser */}
                        {leftTab === 'transcript' && (
                          <div className="h-full flex flex-col space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search words in transcript..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>

                            <div className="flex-1 overflow-y-auto border border-stone-100 dark:border-zinc-800/40 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800 bg-stone-50/40 dark:bg-zinc-950/40">
                              {filteredSegments.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-500 dark:text-zinc-500 italic">
                                  No segments match your search.
                                </div>
                              ) : (
                                filteredSegments.map((seg, idx) => (
                                  <div key={idx} className="p-3 hover:bg-stone-100/50 dark:hover:bg-zinc-900/50 transition-colors flex items-start space-x-3 text-xs leading-relaxed">
                                    <div className="flex items-center space-x-1 text-[11px] font-mono font-bold bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border dark:border-zinc-700/50 shrink-0 select-none">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatTime(seg.start)}</span>
                                    </div>
                                    <span className="text-stone-700 dark:text-zinc-300 font-sans">{seg.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Book Chapter Editor Viewer */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    {/* Editorial Controls Toolbar */}
                    <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200 shadow-sm'
                    }`}>
                      {/* Typography toggles */}
                      <div className="flex items-center space-x-2">
                        <Type className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mr-1">FONT</span>
                        <div className="bg-stone-100 dark:bg-zinc-950 p-0.5 rounded-lg border dark:border-zinc-800/40 flex">
                          {(['serif', 'sans', 'mono'] as const).map((style) => (
                            <button
                              key={style}
                              onClick={() => setBookStyle(style)}
                              className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                                bookStyle === style
                                  ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-sm'
                                  : 'text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200'
                              }`}
                            >
                              {style.charAt(0).toUpperCase() + style.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size toggles */}
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mr-1">SIZE</span>
                        <div className="bg-stone-100 dark:bg-zinc-950 p-0.5 rounded-lg border dark:border-zinc-800/40 flex">
                          {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                            <button
                              key={size}
                              onClick={() => setFontSize(size)}
                              className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                                fontSize === size
                                  ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-sm'
                                  : 'text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200'
                              }`}
                            >
                              {size.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Paper Background Style */}
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mr-1">PAPER</span>
                        <div className="flex space-x-1.5">
                          {[
                            { id: 'cream', bg: 'bg-[#faf6f0] border-amber-200/50', label: 'Cream' },
                            { id: 'white', bg: 'bg-white border-stone-200', label: 'White' },
                            { id: 'stone', bg: 'bg-[#f4f3f0] border-stone-300', label: 'Stone' },
                            { id: 'dark', bg: 'bg-[#18181b] border-zinc-800', label: 'Dark' }
                          ].map((themeOpt) => (
                            <button
                              key={themeOpt.id}
                              onClick={() => setPaperTheme(themeOpt.id as any)}
                              className={`w-6 h-6 rounded-full border-2 ${themeOpt.bg} transition-all ${
                                paperTheme === themeOpt.id ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-zinc-900 scale-110' : 'opacity-80 hover:scale-105'
                              }`}
                              title={themeOpt.label}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Virtual Book reading frame */}
                    <div className={`rounded-2xl border transition-all duration-300 ${
                      paperTheme === 'cream' 
                        ? 'bg-[#faf6f0] border-amber-100 text-[#292524] shadow-md shadow-amber-900/5' 
                        : paperTheme === 'white'
                          ? 'bg-white border-stone-200 text-stone-900 shadow-sm'
                          : paperTheme === 'stone'
                            ? 'bg-[#f4f3f0] border-stone-200 text-[#1c1917] shadow-sm'
                            : 'bg-[#121214] border-zinc-800/80 text-zinc-200'
                    } p-8 md:p-12 h-[550px] overflow-y-auto`}>
                      
                      {/* Markdown parsing display with styled system */}
                      <article className={`
                        prose dark:prose-invert max-w-none focus:outline-none text-justify
                        ${bookStyle === 'serif' ? 'font-serif-book' : bookStyle === 'mono' ? 'font-mono-book' : 'font-sans-book'}
                        ${fontSize === 'sm' ? 'text-sm' : fontSize === 'base' ? 'text-base' : fontSize === 'lg' ? 'text-lg' : 'text-xl'}
                      `}>
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: parseMarkdownToHtml(formattedChapter, bookStyle) 
                          }} 
                        />
                      </article>
                    </div>

                    {/* EXPORT OPTIONS BAR */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      
                      <button
                        onClick={handleCopyText}
                        className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-xl border dark:border-zinc-800 text-xs font-semibold tracking-wide text-stone-600 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copyStatus === 'copied_text' ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500 animate-scale-up" />
                            <span className="text-emerald-500">Plain Text Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-stone-400" />
                            <span>Copy Plain Text</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleCopyMarkdown}
                        className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-xl border dark:border-zinc-800 text-xs font-semibold tracking-wide text-stone-600 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copyStatus === 'copied_md' ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500 animate-scale-up" />
                            <span className="text-emerald-500">MD Code Copied!</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 text-stone-400" />
                            <span>Copy Markdown</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownloadMarkdown}
                        className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-xl border dark:border-zinc-800 text-xs font-semibold tracking-wide text-stone-600 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-stone-400" />
                        <span>Export MD File</span>
                      </button>

                      <button
                        onClick={handlePrintPdf}
                        className="px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/10"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Download PDF</span>
                      </button>

                    </div>

                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer bar */}
      <footer className={`border-t mt-16 py-8 text-center text-xs ${
        theme === 'dark' ? 'border-zinc-800 bg-zinc-900/20 text-zinc-500' : 'border-stone-200 bg-stone-100/40 text-stone-500'
      }`}>
        <p className="font-serif-display italic mb-1 text-sm text-stone-600 dark:text-zinc-400">❖ Stay Hungry. Stay Foolish. ❖</p>
        <p>© 2026 ScribeTube Editorial Laboratory. Structured and parsed securely client-side.</p>
      </footer>

    </div>
  );
}
