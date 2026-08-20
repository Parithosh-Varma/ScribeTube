"""RSS/URL ingestion for the Knowledge OS.

Ported from morning-digest (morning_digest.py):
  - story_key(): sha256 of the normalized title (cross-day dedup)
  - fetch_feed(): feedparser parse + normalization + per-feed caps

The caller (server.py routes) owns the database connection and uses
ON CONFLICT (dedupe_key) DO NOTHING to skip already-known items.
"""

import hashlib
import re
from datetime import datetime, timezone

import feedparser

MAX_ITEMS_PER_FEED = 3
MAX_SUMMARY_LENGTH = 150


def story_key(title):
    normalized = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _published_at(entry):
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return ""
    try:
        return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return ""


def fetch_feed(url, max_items=MAX_ITEMS_PER_FEED):
    """Fetch and normalize an RSS/Atom feed into import-ready items.

    Returns a list of dicts: {source, title, summary, link, key, published_at}.
    Raises feedparser/network exceptions so the route can surface them.
    """
    feed = feedparser.parse(url)
    if getattr(feed, "bozo", False) and not feed.entries:
        raise ValueError(f"Feed may be malformed: {url}")

    source = str(getattr(feed.feed, "title", "") or "").strip() or url
    items = []
    seen = set()
    for entry in feed.entries[:max_items]:
        title = str(entry.get("title") or "").strip()
        link = str(entry.get("link") or "").strip()
        if not title:
            continue
        dedupe = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()[:120]
        if dedupe in seen:
            continue
        seen.add(dedupe)
        summary = " ".join(str(entry.get("summary") or "").split())[:MAX_SUMMARY_LENGTH]
        items.append({
            "source": source,
            "title": title,
            "summary": summary,
            "link": link,
            "key": story_key(title),
            "published_at": _published_at(entry),
        })
    return items