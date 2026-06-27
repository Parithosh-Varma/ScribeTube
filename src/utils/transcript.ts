export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface VideoMetadata {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

/**
 * Extracts a YouTube video ID from any standard YouTube URL format.
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim();
  
  // Regular expression to handle various YouTube URL schemas
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = cleaned.match(regExp);
  
  if (match && match[1]) {
    return match[1];
  }
  
  // If the input is just an 11-char ID, return it
  if (cleaned.length === 11 && !cleaned.includes('/') && !cleaned.includes('?')) {
    return cleaned;
  }
  
  return null;
}

/**
 * Fetches YouTube video metadata from the local Python backend, with an oEmbed fallback.
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    const API_BASE = window.location.port === "5173" ? "http://localhost:8080" : "";
    const res = await fetch(`${API_BASE}/api/metadata?v=${videoId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return await res.json();
  } catch {
    // fall through
  }

  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        return {
          id: videoId,
          title: data.title || "Untitled YouTube Video",
          channel: data.author_name || "Unknown Creator",
          thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    }
  } catch {
    // fall through
  }

  return {
    id: videoId,
    title: `YouTube Video (${videoId})`,
    channel: "YouTube Creator",
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string): Promise<string> {
  for (const buildProxyUrl of PROXIES) {
    try {
      const proxyUrl = buildProxyUrl(url);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }
  throw new Error("All proxy services failed to fetch the YouTube page.");
}

/**
 * Primary method: Fetches transcript from the local Python backend.
 */
async function fetchTranscriptFromBackend(videoId: string): Promise<TranscriptSegment[]> {
  const API_BASE = window.location.port === "5173" ? "http://localhost:8080" : "";
  const res = await fetch(`${API_BASE}/api/transcript?v=${videoId}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend returned status ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No transcript segments returned.");
  }
  return data.map((item: any) => ({
    text: item.text || item.text || "",
    start: parseFloat(item.start ?? 0),
    duration: parseFloat(item.duration ?? 0),
  }));
}

/**
 * Secondary method: Scrapes YouTube page via CORS proxies, extracts player config,
 * parses track list, downloads XML captions, and converts to segments.
 */
async function fetchTranscriptByScraping(videoId: string): Promise<TranscriptSegment[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetchWithProxy(videoUrl);

  const regex = /ytInitialPlayerResponse\s*=\s*({.+?});/i;
  const match = html.match(regex);
  if (!match) {
    throw new Error("Transcripts are disabled, private, or could not be found for this video.");
  }

  let playerResponse;
  try {
    const jsonStr = match[1].trim().replace(/;$/, "");
    playerResponse = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse YouTube player configuration.");
  }

  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
    throw new Error("No caption tracks or transcripts found on this video.");
  }

  const track = captionTracks.find((t: any) => t.languageCode === "en") ||
                captionTracks.find((t: any) => t.languageCode.startsWith("en")) ||
                captionTracks[0];

  if (!track || !track.baseUrl) {
    throw new Error("No readable captions track found.");
  }

  const captionXml = await fetchWithProxy(track.baseUrl);

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(captionXml, "text/xml");
  const textElements = xmlDoc.getElementsByTagName("text");

  const segments: TranscriptSegment[] = [];
  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i];
    const text = el.textContent || "";
    const start = parseFloat(el.getAttribute("start") || "0");
    const duration = parseFloat(el.getAttribute("dur") || "0");
    const decodedText = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (decodedText) {
      segments.push({ text: decodedText, start, duration });
    }
  }

  if (segments.length === 0) {
    throw new Error("Captions XML was empty or unparseable.");
  }

  return segments;
}

/**
 * Combined fetcher that tries local Python backend first, then scraping fallback.
 */
export async function fetchTranscript(urlOrId: string): Promise<{ segments: TranscriptSegment[]; rawText: string }> {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    throw new Error("Invalid YouTube URL or Video ID format.");
  }

  let segments: TranscriptSegment[] = [];
  let errorMsg = "";

  try {
    segments = await fetchTranscriptFromBackend(videoId);
  } catch (primaryError: any) {
    console.warn("Local backend failed, trying scraping fallback...", primaryError);
    errorMsg = primaryError.message || "Backend method failed";

    try {
      segments = await fetchTranscriptByScraping(videoId);
    } catch (scrapingError: any) {
      throw new Error(`Failed to fetch transcript. ${scrapingError.message || errorMsg}`);
    }
  }

  if (!segments || segments.length === 0) {
    throw new Error("The video does not have any manual or auto-generated transcripts available.");
  }

  const rawText = segments.map((s) => s.text).join(" ");

  return { segments, rawText };
}

/**
 * Local Smart Heuristic Editor: Formats a raw transcript into a book chapter.
 * Used when no API Key is available or inside Sandbox mode.
 */
export function formatLocalBookChapter(title: string, channel: string, rawText: string): string {
  // 1. Clean up transcription noise & filler words
  let cleaned = rawText
    .replace(/\b(um|uh|err|ah|you\sknow|like|basically|actually|sort\sof|kind\sof|now\sso|so\sanyway)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
    
  // Ensure capital letters at starts of sentences
  cleaned = cleaned.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, separator, char) => separator + char.toUpperCase());

  // 2. Fragment text into sentences and paragraphs
  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s+|$)/g) || [cleaned];
  const paragraphs: string[] = [];
  let currentParagraph = "";
  
  sentences.forEach((sentence) => {
    currentParagraph += sentence.trim() + " ";
    // Target paragraph size of roughly 120-180 words or when sentence finishes with strong punctuation
    const wordCount = currentParagraph.split(/\s+/).length;
    if (wordCount >= 130) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = "";
    }
  });
  
  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim());
  }
  
  // If we ended up with very few paragraphs, just chunk the text
  if (paragraphs.length === 0) {
    paragraphs.push(cleaned);
  }

  // 3. Construct Chapter Sections
  const chapterTitle = `Chapter: The Wisdom of ${title.replace(/[\[\]]/g, "")}`;
  const adaptHeader = `*Adapted from "${title}" by ${channel}.*`;
  
  const totalParagraphs = paragraphs.length;
  const introParagraphs = Math.max(1, Math.min(2, Math.floor(totalParagraphs * 0.15)));
  const sectionSize = Math.max(1, Math.floor((totalParagraphs - introParagraphs) / 3));
  
  let md = `# ${chapterTitle}\n\n${adaptHeader}\n\n---\n\n`;
  
  // Introduction Section
  md += `## Introduction: Navigating the Core Ideas\n\n`;
  for (let i = 0; i < introParagraphs; i++) {
    md += `${paragraphs[i]}\n\n`;
  }
  md += `---\n\n`;
  
  // Define titles based on keyword heuristic or falls back to generic
  const hasAILlms = cleaned.toLowerCase().includes("intelligence") || cleaned.toLowerCase().includes("model") || cleaned.toLowerCase().includes("data");
  const hasBusiness = cleaned.toLowerCase().includes("business") || cleaned.toLowerCase().includes("company") || cleaned.toLowerCase().includes("leader") || cleaned.toLowerCase().includes("product");
  const hasCreative = cleaned.toLowerCase().includes("art") || cleaned.toLowerCase().includes("creative") || cleaned.toLowerCase().includes("write") || cleaned.toLowerCase().includes("fail");
  
  let sectionTitles = [
    "I. Foundational Principles and Structural Frameworks",
    "II. The Mechanics of Execution and Implementation",
    "III. Deep Analytical Insights and Real-World Applications"
  ];
  
  if (hasAILlms) {
    sectionTitles = [
      "I. The Technical Foundation and Underlying Architecture",
      "II. Training Paradigms: From Data Scrapes to Deep Learning",
      "III. Practical Deployments and Future System Paradigms"
    ];
  } else if (hasBusiness) {
    sectionTitles = [
      "I. Defining the Central Purpose and Belief Systems",
      "II. Strategic Execution: Aligning Biology and Business Operations",
      "III. Cultivating Trust and Magnetizing True Believers"
    ];
  } else if (hasCreative) {
    sectionTitles = [
      "I. The Creative Compass: Finding Your Mountain",
      "II. Navigating Professional Mechanics and the Rules of Engagement",
      "III. Transmuting Adversity into Transcendent Expressions"
    ];
  }
  
  // Section 1
  let pIdx = introParagraphs;
  md += `## ${sectionTitles[0]}\n\n`;
  const s1End = pIdx + sectionSize;
  while (pIdx < s1End && pIdx < totalParagraphs) {
    // Occasionally wrap text in blockquotes or add a stylized quote
    if (pIdx === Math.floor((introParagraphs + s1End) / 2)) {
      md += `> "${paragraphs[pIdx].substring(0, Math.min(130, paragraphs[pIdx].length))}..."\n\n`;
    }
    md += `${paragraphs[pIdx]}\n\n`;
    pIdx++;
  }
  md += `---\n\n`;
  
  // Section 2
  md += `## ${sectionTitles[1]}\n\n`;
  const s2End = pIdx + sectionSize;
  while (pIdx < s2End && pIdx < totalParagraphs) {
    md += `${paragraphs[pIdx]}\n\n`;
    pIdx++;
  }
  md += `---\n\n`;
  
  // Section 3
  md += `## ${sectionTitles[2]}\n\n`;
  while (pIdx < totalParagraphs) {
    md += `${paragraphs[pIdx]}\n\n`;
    pIdx++;
  }
  md += `---\n\n`;
  
  // Generate Key Takeaways dynamically
  md += `## Key Takeaways\n\n`;
  
  // Extract key sentences for takeaways
  const potentialTakeaways = paragraphs.filter(p => p.includes("important") || p.includes("key") || p.includes("must") || p.includes("should") || p.includes("believe") || p.includes("learn"));
  const bullets = [
    `**Core Philosophy**: Focus on the foundational principles, maintaining a clear vision of your personal or organizational purpose.`,
    `**Adaptability and Resilience**: Learn to view setbacks not as definitive blockades, but as instructional pivot points that strip away the inessential.`,
    `**The Synergy of Execution**: Understand that high-quality results require a harmonious balance of deep competence, reliable consistency, and cooperative alignment.`,
    `**The Leverage of Empathy and Context**: Cultivate active imagination to align your work with the deeper emotional drives, experiences, and contexts of others.`
  ];
  
  if (potentialTakeaways.length > 0) {
    bullets[0] = `**Primary Vision**: ${potentialTakeaways[0].split(/[.!?]/)[0]}.`;
    if (potentialTakeaways.length > 1) {
      bullets[1] = `**Core Mechanic**: ${potentialTakeaways[1].split(/[.!?]/)[0]}.`;
    }
    if (potentialTakeaways.length > 2) {
      bullets[2] = `**Strategic Alignment**: ${potentialTakeaways[2].split(/[.!?]/)[0]}.`;
    }
  }
  
  bullets.forEach((bullet) => {
    md += `1. ${bullet}\n`;
  });
  
  return md;
}
