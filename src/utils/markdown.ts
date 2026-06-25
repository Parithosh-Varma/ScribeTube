/**
 * A lightweight markdown parser tailored for elegant book formatting.
 * Outputs styled HTML with the ScribeTube design system colors.
 */
export function parseMarkdownToHtml(markdown: string, styling: 'serif' | 'sans' | 'mono' = 'serif'): string {
  if (!markdown) return "";

  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let isFirstParagraph = true;

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

    // Code Block
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        html += `<pre style="background:#EDE7D4;border:1px solid #C9A463;border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#1C1E22;overflow-x:auto;margin:24px 0;white-space:pre-wrap"><code>${codeContent.join("\n")}</code></pre>\n`;
        codeContent = [];
      } else {
        closeListIfOpen();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      const escapedLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      codeContent.push(escapedLine);
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      closeListIfOpen();
      html += `<div style="display:flex;align-items:center;justify-content:center;margin:40px 0"><div style="height:1px;width:80px;background:linear-gradient(to right,transparent,#C9A463)"></div><span style="margin:0 16px;color:#C9A463;font-family:'Fraunces',Georgia,serif;font-size:14px;letter-spacing:0.25em">&#10045; &#10045; &#10045;</span><div style="height:1px;width:80px;background:linear-gradient(to left,transparent,#C9A463)"></div></div>\n`;
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      closeListIfOpen();
      const titleText = inlineFormat(trimmed.substring(2));
      html += `<h1 style="font-family:'Fraunces',Georgia,serif;font-size:32px;font-weight:700;letter-spacing:-0.02em;color:#1C1E22;text-align:center;margin:16px 0 32px;line-height:1.2">${titleText}</h1>\n`;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      closeListIfOpen();
      const h2Text = inlineFormat(trimmed.substring(3));
      html += `<h2 style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:700;color:#1C1E22;border-bottom:1px solid #C9A463;padding-bottom:8px;margin:48px 0 20px;letter-spacing:0.05em;text-transform:uppercase">${h2Text}</h2>\n`;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeListIfOpen();
      const h3Text = inlineFormat(trimmed.substring(4));
      html += `<h3 style="font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:600;color:#1C1E22;margin:32px 0 16px">${h3Text}</h3>\n`;
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith("> ")) {
      closeListIfOpen();
      const quoteText = inlineFormat(trimmed.substring(2));
      html += `<blockquote style="border-left:4px solid #8B3A3A;background:rgba(139,58,58,0.05);padding:12px 24px;font-style:italic;margin:32px 0;color:#8A8D93;font-family:'Fraunces',Georgia,serif;border-radius:0 8px 8px 0">${quoteText}</blockquote>\n`;
      continue;
    }

    // Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeListIfOpen();
        html += `<ol style="list-style-type:decimal;padding-left:24px;margin:24px 0;display:flex;flex-direction:column;gap:12px;color:#1C1E22;line-height:1.7;font-family:'Fraunces',Georgia,serif">\n`;
        inList = true;
        listType = "ol";
      }
      html += `  <li>${inlineFormat(olMatch[2])}</li>\n`;
      continue;
    }

    // Unordered lists
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeListIfOpen();
        html += `<ul style="list-style-type:disc;padding-left:24px;margin:24px 0;display:flex;flex-direction:column;gap:12px;color:#1C1E22;line-height:1.7;font-family:'Fraunces',Georgia,serif">\n`;
        inList = true;
        listType = "ul";
      }
      html += `  <li>${inlineFormat(ulMatch[1])}</li>\n`;
      continue;
    }

    // Empty line
    if (trimmed === "") {
      closeListIfOpen();
      continue;
    }

    // Standard paragraph
    closeListIfOpen();
    let pContent = inlineFormat(trimmed);

    if (isFirstParagraph && styling === 'serif' && pContent.length > 50 && !pContent.startsWith("<") && !pContent.startsWith("*")) {
      const firstLetter = pContent.charAt(0);
      const remaining = pContent.substring(1);
      html += `<p style="font-family:'Fraunces',Georgia,serif;font-size:18px;color:#1C1E22;line-height:1.75;margin-bottom:24px;text-align:justify"><span style="font-size:56px;font-weight:700;color:#8B3A3A;float:left;line-height:44px;padding-right:10px;padding-top:4px;font-family:'Fraunces',Georgia,serif">${firstLetter}</span>${remaining}</p>\n`;
      isFirstParagraph = false;
    } else {
      html += `<p style="font-family:'Fraunces',Georgia,serif;font-size:18px;color:#1C1E22;line-height:1.75;margin-bottom:24px;text-align:justify">${pContent}</p>\n`;
      isFirstParagraph = false;
    }
  }

  closeListIfOpen();
  return html;
}

/**
 * Format inline elements: bold, italics, links, code
 */
function inlineFormat(text: string): string {
  if (!text) return "";

  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#1C1E22">$1</strong>');
  result = result.replace(/__(.*?)__/g, '<strong style="font-weight:700;color:#1C1E22">$1</strong>');

  // Italics
  result = result.replace(/\*(.*?)\*/g, '<em style="font-style:italic">$1</em>');
  result = result.replace(/_(.*?)_/g, '<em style="font-style:italic">$1</em>');

  // Inline code
  result = result.replace(/`(.*?)`/g, '<code style="background:#EDE7D4;border:1px solid #C9A463;border-radius:4px;padding:2px 6px;font-family:\'JetBrains Mono\',monospace;font-size:14px;color:#8B3A3A">$1</code>');

  return result;
}
