"""Transcribe the YouTube audio with AssemblyAI (speaker labels on).

Each result is cached in $SEED_WORK_DIR/cache/assemblyai/<id>.json, so a
rerun does not spend credits again. Files are sent in parallel.

Usage: python scripts/seed/transcribe.py [youtube_id ...]
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # find common.py when run with -I
from common import CACHE, MEETINGS, RAW, load_env

API = "https://api.assemblyai.com/v2"

# Tried in order until AssemblyAI accepts one.
MODEL_OPTIONS = [
    {"speech_models": ["universal-3-pro", "universal-2"]},
    {"speech_model": "best"},
    {},
]


def call(method, url, body=None, data=None, content_type="application/json"):
    headers = {"authorization": os.environ["ASSEMBLYAI_API_KEY"]}
    if body is not None:
        data = json.dumps(body).encode()
    if data is not None:
        headers["content-type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())


def find_audio(vid):
    for f in (RAW / "yt").iterdir():
        if f.stem == vid:
            return f
    raise FileNotFoundError(vid)


def transcribe(vid):
    out = CACHE / "assemblyai" / f"{vid}.json"
    if out.exists():
        print(vid, "cached")
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    audio = find_audio(vid)
    upload = call("POST", f"{API}/upload", data=audio.read_bytes(), content_type="application/octet-stream")
    job = None
    for opt in MODEL_OPTIONS:
        body = {"audio_url": upload["upload_url"], "speaker_labels": True, "language_code": "en",
                "punctuate": True, "format_text": True, **opt}
        try:
            job = call("POST", f"{API}/transcript", body=body)
            print(vid, "submitted with", opt or "default model")
            break
        except urllib.error.HTTPError as e:
            print(vid, "model option rejected:", opt, e.code, e.read()[:200])
    if job is None:
        raise RuntimeError("AssemblyAI rejected every model option")
    while True:
        time.sleep(15)
        res = call("GET", f"{API}/transcript/{job['id']}")
        if res["status"] == "completed":
            out.write_text(json.dumps(res))
            print(vid, "done", res.get("speech_model"), res.get("audio_duration"), "s")
            return
        if res["status"] == "error":
            raise RuntimeError(f"{vid}: {res.get('error')}")


if __name__ == "__main__":
    load_env()
    ids = sys.argv[1:] or [m["key"] for m in MEETINGS if m["source"] == "youtube"]
    with ThreadPoolExecutor(len(ids)) as pool:
        for f in [pool.submit(transcribe, i) for i in ids]:
            f.result()
