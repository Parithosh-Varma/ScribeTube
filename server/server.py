from flask import Flask, jsonify, request
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__)
CORS(app)

@app.route("/api/transcript")
def get_transcript():
    video_id = request.args.get("v")
    if not video_id or len(video_id) != 11:
        return jsonify({"error": "Invalid video ID"}), 400

    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id, languages=["en"])
        result = []
        for seg in transcript:
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
