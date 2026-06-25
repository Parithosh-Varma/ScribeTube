import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__, static_folder="../dist", static_url_path="")
CORS(app)


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

        # Try English first
        transcript = None
        for t in transcript_list:
            if t.language_code == "en":
                transcript = t
                break

        # Fall back to first available
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

if __name__ == "__main__":
    print("Starting ScribeTube backend on http://localhost:8080")
    app.run(host="0.0.0.0", port=8080, debug=False)
