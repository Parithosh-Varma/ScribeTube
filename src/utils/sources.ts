const API_BASE = window.location.port === "5173" ? "http://localhost:8080" : "";

export interface SourceItem {
  id: number;
  type: "video" | "chat" | "link";
  title: string;
  source_name: string | null;
  url: string | null;
  thumbnail: string | null;
  raw_content: string | null;
  processed_content: string | null;
  tags: string[] | null;
  created_at: string;
}

export async function getSources(params: { q?: string; type?: string } = {}): Promise<SourceItem[]> {
  try {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.type) qs.set("type", params.type);
    const res = await fetch(`${API_BASE}/api/sources?${qs.toString()}`);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function importChat(content: string): Promise<{ ok: boolean; error?: string; title?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/import-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, title: data.title };
    return { ok: false, error: data.error || "Import failed" };
  } catch {}
  return { ok: false, error: "Network error" };
}

export async function importRss(url: string, maxItems: number): Promise<{ ok: boolean; error?: string; imported?: number; skipped?: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/import-rss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, max_items: maxItems }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, imported: data.imported, skipped: data.skipped };
    return { ok: false, error: data.error || "Import failed" };
  } catch {}
  return { ok: false, error: "Network error" };
}

export async function deleteSource(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sources/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {}
  return false;
}