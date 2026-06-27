const API_BASE = window.location.port === "5173" ? "http://localhost:8080" : "";

export interface HistoryItem {
  id: number;
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

export interface FavoriteItem {
  id: number;
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  created_at: string;
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/history`);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function saveHistory(item: {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  transcript: string;
  chapter: string;
}): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch {}
  return null;
}

export async function deleteHistory(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {}
  return false;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/favorites`);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function addFavorite(item: {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch {}
  return false;
}

export async function removeFavorite(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/favorites/${videoId}`, { method: "DELETE" });
    return res.ok;
  } catch {}
  return false;
}

export async function checkFavorite(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/favorites/check/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      return data.starred;
    }
  } catch {}
  return false;
}
