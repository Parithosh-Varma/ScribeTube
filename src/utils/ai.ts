/**
 * Handles communication with AI providers (Anthropic, OpenAI, and Google Gemini)
 * bypassing CORS limits using corsproxy.io.
 */

export interface AIProviderConfig {
  id: string;
  name: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  keyPlaceholder: string;
  keyUrl: string;
}

export const aiProviders: AIProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Latest)" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" }
    ],
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/"
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o", name: "GPT-4o (Premium)" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Cost-efficient)" }
    ],
    keyPlaceholder: "sk-proj-...",
    keyUrl: "https://platform.openai.com/"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Rich Context)" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Lightweight)" }
    ],
    keyPlaceholder: "AIzaSy...",
    keyUrl: "https://aistudio.google.com/"
  },
  {
    id: "local",
    name: "Play Sandbox / Local Formatter",
    defaultModel: "local-heuristic",
    models: [
      { id: "local-heuristic", name: "Local Smart Heuristic (No Key Required)" }
    ],
    keyPlaceholder: "No API Key required!",
    keyUrl: ""
  }
];

const SYSTEM_PROMPT = `You are a professional editor. Convert the given YouTube transcript into a polished book chapter. Add a chapter title, introduction, subheadings to organize ideas, smooth flowing prose (remove filler words, repetition, false starts), and a key takeaways section at the end. Preserve all ideas and information.`;

/**
 * Executes a call to the specified AI model using the provided key and prompt data.
 */
export async function generateBookChapter(
  providerId: string,
  apiKey: string,
  modelId: string,
  videoTitle: string,
  channelName: string,
  transcriptText: string
): Promise<string> {
  const userPrompt = `Here is the YouTube transcript of the video titled "${videoTitle}" by ${channelName}:\n\n${transcriptText}`;

  if (providerId === "anthropic") {
    return await callAnthropic(apiKey, modelId, userPrompt);
  } else if (providerId === "openai") {
    return await callOpenAI(apiKey, modelId, userPrompt);
  } else if (providerId === "gemini") {
    return await callGemini(apiKey, modelId, userPrompt);
  } else {
    throw new Error("Invalid AI provider selected");
  }
}

/**
 * Call Anthropic Claude via CORS Proxy
 */
async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  if (!apiKey) throw new Error("Anthropic API key is missing. Please enter it in settings.");
  
  const destUrl = "https://api.anthropic.com/v1/messages";
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(destUrl)}`;
  
  const payload = {
    model: model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };
  
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: { message: errorText } };
    }
    throw new Error(parsedError?.error?.message || `Anthropic API returned status ${res.status}`);
  }
  
  const data = await res.json();
  const content = data?.content?.[0]?.text;
  if (!content) throw new Error("No text was returned by Claude.");
  
  return content;
}

/**
 * Call OpenAI GPT via CORS Proxy
 */
async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key is missing. Please enter it in settings.");
  
  const destUrl = "https://api.openai.com/v1/chat/completions";
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(destUrl)}`;
  
  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: prompt
      }
    ]
  };
  
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: { message: errorText } };
    }
    throw new Error(parsedError?.error?.message || `OpenAI API returned status ${res.status}`);
  }
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No text was returned by GPT.");
  
  return content;
}

/**
 * Call Google Gemini via CORS Proxy (Using developer-friendly standard requests)
 */
async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  if (!apiKey) throw new Error("Gemini API key is missing. Please enter it in settings.");
  
  // Google Gemini API URL includes the key inside query parameters,
  // we proxy the entire request with key.
  const destUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(destUrl)}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nInput Transcript:\n${prompt}`
          }
        ]
      }
    ]
  };
  
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: { message: errorText } };
    }
    throw new Error(parsedError?.error?.message || `Gemini API returned status ${res.status}`);
  }
  
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("No text was returned by Gemini.");
  
  return content;
}
