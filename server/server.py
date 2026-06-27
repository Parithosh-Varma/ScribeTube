import os
import json
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import psycopg2
import psycopg2.extras

app = Flask(__name__, static_folder="../dist", static_url_path="")
CORS(app)

DATABASE_URL = os.environ.get("NEON_DATABASE_URL")

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn

def init_db():
    if not DATABASE_URL:
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

if DATABASE_URL:
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


@app.route("/api/transcript")
def get_transcript():
    video_id = request.args.get("v")
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "Invalid video ID"}), 400

    api = YouTubeTranscriptApi()
    try:
        transcript_list = api.list(video_id)
        if not transcript_list:
            return jsonify({"error": "No transcripts available for this video"}), 404

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
        if not result:
            return jsonify({"error": "No transcript segments found"}), 404
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/metadata")
def get_metadata():
    video_id = request.args.get("v")
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "Invalid video ID"}), 400

    try:
        import requests
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
    if not DATABASE_URL:
        return jsonify([]), 200
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT 50")
    rows = cur.fetchall()
    conn.close()
    return jsonify([{k: str(v) if isinstance(v, datetime) else v for k, r in rows for k, v in [k, r]}] if rows else [])


@app.route("/api/history", methods=["POST"])
def save_history():
    if not DATABASE_URL:
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
    if not DATABASE_URL:
        return jsonify({"error": "Database not configured"}), 503
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM history WHERE id = %s", (item_id,))
    conn.close()
    return jsonify({"ok": True})


# ── FAVORITES ──

@app.route("/api/favorites", methods=["GET"])
def get_favorites():
    if not DATABASE_URL:
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
    if not DATABASE_URL:
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
    if not DATABASE_URL:
        return jsonify({"error": "Database not configured"}), 503
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM favorites WHERE video_id = %s", (video_id,))
    conn.close()
    return jsonify({"ok": True, "starred": False})


@app.route("/api/favorites/check/<video_id>", methods=["GET"])
def check_favorite(video_id):
    if not DATABASE_URL:
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
