"""AI-chat import for the Knowledge OS.

Parses exports produced by the open-ai-scroll extension
(https://github.com/Parithosh-Varma/open-ai-scroll), whose JSON shape is:

    {
      "platform": { "name": "ChatGPT", ... },
      "title": "...",
      "url": "...",
      "exportedAt": "...",
      "turns": [ { "role": "user|assistant", "blocks": [...] } ]
    }

Blocks: {type: p|h|code|table|image|list, ...}. The renderer mirrors
open-ai-scroll's export/renderers.js toMarkdown() so output stays consistent.
"""

import json

from .rss_import import story_key

ROLE_LABEL = {"user": "User", "assistant": "Assistant", "system": "System", "unknown": "Unknown"}


def _platform_name(data):
    platform = data.get("platform") or {}
    if isinstance(platform, dict):
        return platform.get("name") or ""
    return str(platform)


def render_chat_markdown(data):
    lines = [f"# {data.get('title') or 'Conversation'}", ""]
    pname = _platform_name(data)
    exported = data.get("exportedAt") or ""
    if pname:
        lines.append(f"> {pname}" + (f" · exported {exported}" if exported else ""))
    lines.append("---")
    for turn in data.get("turns") or []:
        role = ROLE_LABEL.get(turn.get("role"), turn.get("role") or "Unknown")
        lines.extend(["", f"### {role}", ""])
        for block in turn.get("blocks") or []:
            btype = block.get("type")
            if btype == "p":
                lines.extend([block.get("text", ""), ""])
            elif btype == "h":
                level = min(6, int(block.get("level") or 1) + 2)
                lines.extend([f"{'#' * level} {block.get('text', '')}", ""])
            elif btype == "code":
                lang = block.get("lang") or ""
                lines.extend([f"```{lang}", block.get("code", ""), "```", ""])
            elif btype == "table":
                header = block.get("header") or []
                rows = block.get("rows") or []
                esc = lambda c: str(c or "").replace("|", "\\|")
                lines.append("| " + " | ".join(map(esc, header)) + " |")
                lines.append("| " + " | ".join("---" for _ in header) + " |")
                for row in rows:
                    lines.append("| " + " | ".join(map(esc, row)) + " |")
                lines.append("")
            elif btype == "list":
                items = block.get("items") or []
                ordered = bool(block.get("ordered"))
                for i, item in enumerate(items):
                    lines.append(f"{i + 1}. {item}" if ordered else f"- {item}")
                lines.append("")
            elif btype == "image":
                lines.append(f"![{block.get('alt') or 'image'}]({block.get('src') or ''})")
                lines.append("")
        lines.append("---")
    return "\n".join(lines)


def parse_chat_export(payload):
    """Validate an open-ai-scroll export (string or object) into a sources row.

    Returns {title, platform, url, raw, processed, tags, dedupe_key}.
    Raises ValueError on malformed input.
    """
    if isinstance(payload, str):
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")
    elif isinstance(payload, dict):
        data = payload
    else:
        raise ValueError("content must be a JSON string or object")

    if not isinstance(data, dict) or not isinstance(data.get("turns"), list):
        raise ValueError("Expected open-ai-scroll export: { title, platform, url, exportedAt, turns[] }")

    title = (data.get("title") or "Untitled conversation").strip() or "Untitled conversation"
    pname = _platform_name(data)
    tags = ["chat"]
    if pname:
        tags.append(pname.lower().replace(" ", "-"))

    return {
        "title": title,
        "platform": pname,
        "url": data.get("url"),
        "raw": payload if isinstance(payload, str) else json.dumps(data, indent=2),
        "processed": render_chat_markdown(data),
        "tags": tags,
        "dedupe_key": story_key(f"{pname} {title}"),
    }