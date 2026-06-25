/**
 * A lightweight, highly performant markdown parser tailored for elegant book formatting.
 * Turns standard markdown into styled HTML with academic typographic accents.
 */
export function parseMarkdownToHtml(markdown: string, styling: 'serif' | 'sans' | 'mono' = 'serif'): string {
  if (!markdown) return "";

  // Split into lines
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let isFirstParagraph = true;

  // Track if we need to close a list
  const closeListIfOpen = () => {
    if (inList && listType) {
      html += `</${listType}>\n`;
      inList = false;
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block Handling
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // Close code block
        inCodeBlock = false;
        html += `<pre class="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-4 font-mono text-xs text-gray-700 dark:text-zinc-300 overflow-x-auto my-6 whitespace-pre-wrap"><code>${codeContent.join("\n")}</code></pre>\n`;
        codeContent = [];
      } else {
        // Open code block
        closeListIfOpen();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      // Escape HTML tags in code blocks
      const escapedLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeContent.push(escapedLine);
      continue;
    }

    // 2. Horizontal Rule / Literary Ornament
    if (trimmed === "---" || trimmed === "***") {
      closeListIfOpen();
      // Render an elegant literary separator
      html += `
        <div class="flex items-center justify-center my-10 py-2">
          <div class="h-[1px] w-20 bg-gradient-to-r from-transparent to-amber-600/50 dark:to-amber-500/50"></div>
          <span class="mx-4 text-amber-600 dark:text-amber-500 font-serif text-sm tracking-[0.25em]">❖ ❖ ❖</span>
          <div class="h-[1px] w-20 bg-gradient-to-l from-transparent to-amber-600/50 dark:to-amber-500/50"></div>
        </div>
      \n`;
      continue;
    }

    // 3. Headings
    if (trimmed.startsWith("# ")) {
      closeListIfOpen();
      const titleText = inlineFormat(trimmed.substring(2));
      html += `<h1 class="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 text-center font-serif mt-4 mb-8 leading-tight">${titleText}</h1>\n`;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      closeListIfOpen();
      const h2Text = inlineFormat(trimmed.substring(3));
      html += `<h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-zinc-100 border-b border-gray-100 dark:border-zinc-800 pb-2 font-serif mt-12 mb-5 leading-snug tracking-wide">${h2Text}</h2>\n`;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeListIfOpen();
      const h3Text = inlineFormat(trimmed.substring(4));
      html += `<h3 class="text-lg md:text-xl font-semibold text-gray-800 dark:text-zinc-200 font-serif mt-8 mb-4">${h3Text}</h3>\n`;
      continue;
    }

    // 4. Blockquotes
    if (trimmed.startsWith("> ")) {
      closeListIfOpen();
      const quoteText = inlineFormat(trimmed.substring(2));
      html += `<blockquote class="border-l-4 border-amber-600 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/10 pl-6 pr-4 py-3 italic my-8 text-gray-700 dark:text-zinc-300 font-serif rounded-r-lg">${quoteText}</blockquote>\n`;
      continue;
    }

    // 5. Lists (Ordered / Unordered)
    // Ordered lists (e.g., "1. Item")
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeListIfOpen();
        html += `<ol class="list-decimal pl-6 my-6 space-y-3 text-gray-700 dark:text-zinc-300 leading-relaxed font-serif">\n`;
        inList = true;
        listType = "ol";
      }
      html += `  <li>${inlineFormat(olMatch[2])}</li>\n`;
      continue;
    }

    // Unordered lists (e.g., "- Item", "* Item")
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeListIfOpen();
        html += `<ul class="list-disc pl-6 my-6 space-y-3 text-gray-700 dark:text-zinc-300 leading-relaxed font-serif">\n`;
        inList = true;
        listType = "ul";
      }
      html += `  <li>${inlineFormat(ulMatch[1])}</li>\n`;
      continue;
    }

    // 6. Paragraph or Empty line
    if (trimmed === "") {
      closeListIfOpen();
      continue;
    }

    // It's a standard text block
    closeListIfOpen();
    let pContent = inlineFormat(trimmed);
    
    // Apply drop-cap styling if it's the very first paragraph of a serif book chapter
    if (isFirstParagraph && styling === 'serif' && pContent.length > 50 && !pContent.startsWith("<") && !pContent.startsWith("*")) {
      const firstLetter = pContent.charAt(0);
      const remaining = pContent.substring(1);
      html += `<p class="text-lg text-gray-800 dark:text-zinc-200 leading-relaxed font-serif mb-6 first-letter:text-5xl first-letter:font-bold first-letter:text-amber-600 dark:first-letter:text-amber-500 first-letter:mr-3 first-letter:float-left first-letter:leading-none first-letter:mt-1">${firstLetter}${remaining}</p>\n`;
      isFirstParagraph = false;
    } else {
      html += `<p class="text-lg text-gray-800 dark:text-zinc-200 leading-relaxed font-serif mb-6">${pContent}</p>\n`;
      isFirstParagraph = false;
    }
  }

  // Close any unclosed list at the end
  closeListIfOpen();

  return html;
}

/**
 * Format inline elements like bold, italics, links, and code snippets
 */
function inlineFormat(text: string): string {
  if (!text) return "";

  let result = text
    // Escape HTML tags to prevent broken nodes except if they are explicitly part of our builder
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold (**text** or __text__)
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  result = result.replace(/__(.*?)__/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');

  // Italics (*text* or _text_)
  result = result.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  result = result.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

  // Inline code (`code`)
  result = result.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded px-1.5 py-0.5 font-mono text-sm text-amber-600 dark:text-amber-400">$1</code>');

  return result;
}
