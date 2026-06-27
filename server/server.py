import os
import json
import re
import html
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import requests

try:
    import psycopg2
    import psycopg2.extras
    HAS_DB = True
except ImportError:
    HAS_DB = False

app = Flask(__name__, static_folder="../dist", static_url_path="")
CORS(app)

DATABASE_URL = os.environ.get("NEON_DATABASE_URL")

def get_db():
    if not HAS_DB:
        raise RuntimeError("psycopg2 is not installed")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn

def init_db():
    if not DATABASE_URL or not HAS_DB:
        return
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(20) NOT NULL,
            title TEXT NOT NULL,
            channel TEXT,
            thumbnail TEXT,
            url TEXT,
            transcript TEXT,
            chapter TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(20) NOT NULL UNIQUE,
            title TEXT NOT NULL,
            channel TEXT,
            thumbnail TEXT,
            url TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.close()

if DATABASE_URL and HAS_DB:
    init_db()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


def get_proxy_config():
    proxy_url = os.environ.get("YOUTUBE_PROXY")
    if proxy_url:
        return {"http": proxy_url, "https": proxy_url}
    return None

def fetch_transcript_via_api(video_id):
    proxies = get_proxy_config()
    cookies_path = os.environ.get("YOUTUBE_COOKIES")
    api_kwargs = {}
    if proxies:
        api_kwargs["proxies"] = proxies
    if cookies_path and os.path.isfile(cookies_path):
        api_kwargs["cookies"] = cookies_path
    api = YouTubeTranscriptApi(**api_kwargs)
    transcript_list = api.list(video_id)
    if not transcript_list:
        return None
    transcript = None
    for t in transcript_list:
        if t.language_code == "en":
            transcript = t
            break
    if not transcript:
        transcript = list(transcript_list)[0]
    result = []
    for seg in transcript.fetch():
        result.append({
            "text": seg.text,
            "start": seg.start,
            "duration": seg.duration,
        })
    return result if result else None

def _extract_json_from_youtube_page(html_text):
    markers = ["ytInitialPlayerResponse = ", "window.ytInitialPlayerResponse = "]
    for marker in markers:
        idx = html_text.find(marker)
        if idx != -1:
            start = idx + len(marker)
            brace_count = 0
            in_string = False
            for i in range(start, len(html_text)):
                ch = html_text[i]
                if ch == '"' and (i == start or html_text[i - 1] != "\\"):
                    in_string = not in_string
                if not in_string:
                    if ch == "{":
                        brace_count += 1
                    elif ch == "}":
                        brace_count -= 1
                        if brace_count == 0:
                            return html_text[start : i + 1]
    return None


def fetch_transcript_via_scraping(video_id):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    proxies = get_proxy_config()
    url = f"https://www.youtube.com/watch?v={video_id}"

    resp = requests.get(url, headers=headers, proxies=proxies, timeout=15)
    resp.raise_for_status()

    json_str = _extract_json_from_youtube_page(resp.text)
    if not json_str:
        return None

    data = json.loads(json_str)
    caption_tracks = (
        data.get("captions", {})
        .get("playerCaptionsTracklistRenderer", {})
        .get("captionTracks", [])
    )
    if not caption_tracks:
        return None

    track = None
    for t in caption_tracks:
        if t.get("languageCode") == "en":
            track = t
            break
    if not track:
        for t in caption_tracks:
            lc = t.get("languageCode", "")
            if lc.startswith("en"):
                track = t
                break
    if not track:
        track = caption_tracks[0]

    base_url = track.get("baseUrl")
    if not base_url:
        return None

    caption_resp = requests.get(base_url, headers=headers, proxies=proxies, timeout=15)
    caption_resp.raise_for_status()

    segments = []
    for text_elem in re.finditer(r'<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>(.*?)</text>', caption_resp.text, re.DOTALL):
        start = float(text_elem.group(1))
        duration = float(text_elem.group(2))
        text = html.unescape(re.sub(r"<[^>]+>", "", text_elem.group(3)))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            segments.append({"text": text, "start": start, "duration": duration})

    return segments if segments else None


def fetch_transcript_via_youtubetranscript(video_id):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    }
    proxies = get_proxy_config()
    resp = requests.get(
        f"https://youtubetranscript.com/?v={video_id}",
        headers=headers,
        proxies=proxies,
        timeout=15,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    if not isinstance(data, list) or len(data) == 0:
        return None
    result = []
    for item in data:
        text = item.get("text", "")
        if text:
            result.append({
                "text": text,
                "start": float(item.get("start", 0)),
                "duration": float(item.get("duration", 0)),
            })
    return result if result else None


@app.route("/api/transcript")
def get_transcript():
    video_id = request.args.get("v")
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "Invalid video ID"}), 400

    result = None
    last_error = ""

    try:
        result = fetch_transcript_via_api(video_id)
    except Exception as e:
        last_error = f"API method: {e}"

    if not result:
        try:
            result = fetch_transcript_via_scraping(video_id)
        except Exception as e:
            last_error = f"{last_error}; Scraping method: {e}"

    if not result:
        try:
            result = fetch_transcript_via_youtubetranscript(video_id)
        except Exception as e:
            last_error = f"{last_error}; youtubetranscript.com: {e}"

    if not result:
        return jsonify({"error": last_error or "Could not retrieve transcript"}), 500

    return jsonify(result)


@app.route("/api/metadata")
def get_metadata():
    video_id = request.args.get("v")
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "Invalid video ID"}), 400

    try:
        res = requests.get(f"https://noembed.com/embed?url=https://www.youtube.com/watch?v={video_id}", timeout=10)
        data = res.json()
        return jsonify({
            "id": video_id,
            "title": data.get("title", f"YouTube Video ({video_id})"),
            "channel": data.get("author_name", "Unknown Creator"),
            "thumbnail": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"),
            "url": f"https://www.youtube.com/watch?v={video_id}",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── HISTORY ──

@app.route("/api/history", methods=["GET"])
def get_history():
    if not DATABASE_URL or not HAS_DB:
        return jsonify([]), 200
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT 50")
    rows = cur.fetchall()
    conn.close()
    return jsonify([{k: str(v) if isinstance(v, datetime) else v for k, r in rows for k, v in [k, r]}] if rows else [])


@app.route("/api/history", methods=["POST"])
def save_history():
    if not DATABASE_URL or not HAS_DB:
        return jsonify({"error": "Database not configured"}), 503
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO history (video_id, title, channel, thumbnail, url, transcript, chapter) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (data.get("video_id"), data.get("title"), data.get("channel"), data.get("thumbnail"), data.get("url"), data.get("transcript"), data.get("chapter"))
    )
    row_id = cur.fetchone()[0]
    conn.close()
    return jsonify({"id": row_id}), 201


@app.route("/api/history/<int:item_id>", methods=["DELETE"])
def delete_history(item_id):
    if not DATABASE_URL or not HAS_DB:
        return jsonify({"error": "Database not configured"}), 503
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM history WHERE id = %s", (item_id,))
    conn.close()
    return jsonify({"ok": True})


# ── FAVORITES ──

@app.route("/api/favorites", methods=["GET"])
def get_favorites():
    if not DATABASE_URL or not HAS_DB:
        return jsonify([]), 200
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM favorites ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    result = []
    for row in rows:
        result.append({k: str(v) if isinstance(v, datetime) else v for k, v in row.items()})
    return jsonify(result)


@app.route("/api/favorites", methods=["POST"])
def add_favorite():
    if not DATABASE_URL or not HAS_DB:
        return jsonify({"error": "Database not configured"}), 503
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO favorites (video_id, title, channel, thumbnail, url) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (data.get("video_id"), data.get("title"), data.get("channel"), data.get("thumbnail"), data.get("url"))
        )
        row_id = cur.fetchone()[0]
        conn.close()
        return jsonify({"id": row_id, "starred": True}), 201
    except psycopg2.errors.UniqueViolation:
        conn.close()
        return jsonify({"error": "Already in favorites"}), 409


@app.route("/api/favorites/<video_id>", methods=["DELETE"])
def remove_favorite(video_id):
    if not DATABASE_URL or not HAS_DB:
        return jsonify({"error": "Database not configured"}), 503
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM favorites WHERE video_id = %s", (video_id,))
    conn.close()
    return jsonify({"ok": True, "starred": False})


@app.route("/api/favorites/check/<video_id>", methods=["GET"])
def check_favorite(video_id):
    if not DATABASE_URL or not HAS_DB:
        return jsonify({"starred": False}), 200
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM favorites WHERE video_id = %s", (video_id,))
    exists = cur.fetchone() is not None
    conn.close()
    return jsonify({"starred": exists})


if __name__ == "__main__":
    print("Starting ScribeTube backend on http://localhost:8080")
    app.run(host="0.0.0.0", port=8080, debug=False)
