"""Load seed/meetings/*.json into Supabase. Safe to rerun.

For each file: upload the audio (AMI only) to the public 'media' bucket if it
is not there yet, delete the old copy of the meeting (rows cascade), then
insert the meeting, speakers, utterances, chapters, action items and summaries
through the REST API using the service role key. Ends with a count check and
a search check.

Usage: python -I scripts/seed/load.py [slug ...]
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # find common.py when run with -I
from common import RAW, SEED_DIR, load_env, read_json

BATCH = 500


def base():
    return os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")


def request(method, path, body=None, data=None, headers=None):
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    req = urllib.request.Request(base() + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            raw = r.read()
            return (json.loads(raw) if raw else None), r.headers
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path.split('?')[0]} -> {e.code}: {e.read()[:300].decode(errors='replace')}")


def insert(table, rows, returning=False):
    out = []
    for i in range(0, len(rows), BATCH):
        res, _ = request("POST", f"/rest/v1/{table}", body=rows[i:i + BATCH],
                         headers={"Prefer": "return=representation" if returning else "return=minimal"})
        out.extend(res or [])
    return out


def public_url(media_path):
    return f"{base()}/storage/v1/object/public/media/{media_path}"


def upload_media(media_path):
    """Upload an AMI mp3 unless the same-size file is already in the bucket."""
    local = RAW / "ami" / Path(media_path).name
    size = local.stat().st_size
    try:
        with urllib.request.urlopen(urllib.request.Request(public_url(media_path), method="HEAD"), timeout=60) as r:
            if int(r.headers.get("content-length", -1)) == size:
                return
    except urllib.error.HTTPError:
        pass
    request("POST", f"/storage/v1/object/media/{media_path}", data=local.read_bytes(),
            headers={"Content-Type": "audio/mpeg", "x-upsert": "true", "cache-control": "max-age=31536000"})
    print("  uploaded", media_path, f"{size / 1e6:.1f} MB")


def q(v):
    return urllib.parse.quote(str(v), safe="")


def load(doc):
    m = dict(doc["meeting"])
    media_path = m.pop("media_path", None)
    m.pop("source_key", None)
    if media_path:
        upload_media(media_path)
        m["media_url"] = public_url(media_path)
    else:
        m["media_url"] = None

    # Remove any earlier copy, matched by slug or by its unique credit line.
    request("DELETE", f"/rest/v1/meetings?slug=eq.{q(m['slug'])}")
    request("DELETE", f"/rest/v1/meetings?kind=eq.demo&credit=eq.{q(m['credit'])}")

    meeting_id = insert("meetings", [m], returning=True)[0]["id"]
    speakers = insert("speakers", [{"meeting_id": meeting_id, "label": s["label"], "name": s["name"],
                                    "role": s.get("role"), "color": s["color"], "talk_ms": s["talk_ms"],
                                    "turns": s["turns"]} for s in doc["speakers"]], returning=True)
    sid = {s["label"]: s["id"] for s in speakers}
    insert("utterances", [{"meeting_id": meeting_id, "speaker_id": sid[u["speaker"]], "idx": u["idx"],
                           "start_ms": u["start_ms"], "end_ms": u["end_ms"], "text": u["text"]}
                          for u in doc["utterances"]])
    insert("chapters", [{"meeting_id": meeting_id, "idx": c["idx"], "title": c["title"],
                         "start_ms": c["start_ms"], "end_ms": c["end_ms"], "gist": c["gist"]}
                        for c in doc["chapters"]])
    insert("action_items", [{"meeting_id": meeting_id, "idx": a["idx"], "text": a["text"],
                             "owner_name": a["owner_name"], "speaker_id": sid.get(a.get("speaker_label")),
                             "ts_ms": a["ts_ms"]} for a in doc["action_items"]])
    insert("summaries", [{"meeting_id": meeting_id, "template": s["template"], "content": s["content"],
                          "model": s["model"]} for s in doc["summaries"]])
    return meeting_id


def count(table, filt=""):
    _, headers = request("GET", f"/rest/v1/{table}?select=*{filt}",
                         headers={"Prefer": "count=exact", "Range": "0-0"})
    return int(headers["content-range"].split("/")[-1])


def main(slugs):
    load_env()
    files = sorted(SEED_DIR.glob("*.json"))
    for f in files:
        doc = read_json(f)
        if slugs and doc["meeting"]["slug"] not in slugs:
            continue
        mid = load(doc)
        expect = {"speakers": len(doc["speakers"]), "utterances": len(doc["utterances"]),
                  "chapters": len(doc["chapters"]), "action_items": len(doc["action_items"]),
                  "summaries": len(doc["summaries"])}
        got = {t: count(t, f"&meeting_id=eq.{mid}") for t in expect}
        status = "ok" if got == expect else f"MISMATCH expected {expect}"
        print(f"{doc['meeting']['slug']}: {got} {status}")

    print("total meetings:", count("meetings"), "utterances:", count("utterances"))
    res, _ = request("POST", "/rest/v1/rpc/search_utterances", body={"q": "budget"})
    print(f"search 'budget': {len(res)} hits")
    for r in res[:3]:
        print("  ", r["meeting_title"], "|", r["speaker_name"], "|", r["snippet"][:90])


if __name__ == "__main__":
    main(sys.argv[1:])
