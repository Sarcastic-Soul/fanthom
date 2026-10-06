"""Download the raw inputs: AMI annotations + audio, and YouTube audio + metadata.

Skips anything already on disk. Needs yt-dlp, curl and ffmpeg on PATH.

Usage: python scripts/seed/fetch.py
"""

import sys
import json
import subprocess
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # find common.py when run with -I
from common import AMI_ANNOTATIONS, AMI_MIRROR, MEETINGS, RAW


def run(*cmd):
    subprocess.run(cmd, check=True)


def fetch_ami(key):
    ami = RAW / "ami"
    ami.mkdir(parents=True, exist_ok=True)
    zip_path = ami / "ami_manual.zip"
    if not zip_path.exists():
        run("curl", "-sSL", "-o", str(zip_path), AMI_ANNOTATIONS)
    if not (ami / "ann" / "words").exists():
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(ami / "ann")
    wav = ami / f"{key}.wav"
    if not wav.exists():
        run("curl", "-sSL", "-o", str(wav), f"{AMI_MIRROR}/{key}/audio/{key}.Mix-Headset.wav")
    # Small mono mp3 for the web player (well under the 50 MB storage limit).
    mp3 = ami / f"{key}.mp3"
    if not mp3.exists():
        run("ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1", "-b:a", "40k", str(mp3))


def fetch_youtube(vid):
    yt = RAW / "yt"
    yt.mkdir(parents=True, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={vid}"
    meta = yt / f"{vid}.info.json"
    if not meta.exists():
        out = subprocess.run(["yt-dlp", "-J", "--skip-download", url], check=True, capture_output=True, text=True)
        d = json.loads(out.stdout)
        keep = {k: d.get(k) for k in ("id", "title", "description", "duration", "upload_date",
                                      "channel", "playable_in_embed", "webpage_url")}
        meta.write_text(json.dumps(keep, indent=1))
    if not any(f.stem == vid and f.suffix in (".m4a", ".webm", ".mp3", ".opus") for f in yt.iterdir()):
        run("yt-dlp", "-q", "--js-runtimes", "node", "-f", "ba[abr<=80]/ba",
            "-o", str(yt / "%(id)s.%(ext)s"), url)


if __name__ == "__main__":
    for m in MEETINGS:
        print("fetch", m["key"])
        if m["source"] == "ami":
            fetch_ami(m["key"])
        else:
            fetch_youtube(m["key"])
