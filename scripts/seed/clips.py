"""Add a few starter clips per meeting so the Clips page is not empty. Safe to rerun.

Each clip starts at the line where an action item was agreed and runs for
15 to 45 seconds of talk. Clip ids are derived from the meeting and the
action item, so rerunning updates the same rows instead of adding more.

Usage: python -I scripts/seed/clips.py
"""

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_env
from load import request

PER_MEETING = 2
NS = uuid.UUID("6f0d7a52-0c55-4b8e-9d1b-0b3c1f6a9e21")


def main():
    load_env()
    meetings, _ = request("GET", "/rest/v1/meetings?select=id,slug&status=eq.ready")
    rows = []
    for m in meetings:
        items, _ = request("GET", f"/rest/v1/action_items?select=idx,text,ts_ms&meeting_id=eq.{m['id']}&ts_ms=not.is.null&order=idx")
        lines, _ = request("GET", f"/rest/v1/utterances?select=start_ms,end_ms,text&meeting_id=eq.{m['id']}&order=idx&limit=5000")
        for item in items[:PER_MEETING]:
            start = next((i for i, u in enumerate(lines) if u["end_ms"] > item["ts_ms"]), None)
            if start is None:
                continue
            picked = []
            for u in lines[start:]:
                picked.append(u)
                span = u["end_ms"] - picked[0]["start_ms"]
                if span >= 15000 or len(picked) >= 4:
                    break
            begin, end = picked[0]["start_ms"], picked[-1]["end_ms"]
            end = min(end, begin + 45000)
            quote = " ".join(u["text"] for u in picked)
            rows.append({
                "id": str(uuid.uuid5(NS, f"{m['slug']}:{item['idx']}")),
                "meeting_id": m["id"],
                "start_ms": begin,
                "end_ms": end,
                "title": item["text"][:140],
                "quote": quote[:500],
            })
    request("POST", "/rest/v1/highlights?on_conflict=id", body=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(f"{len(rows)} clips across {len(meetings)} meetings")


if __name__ == "__main__":
    main()
