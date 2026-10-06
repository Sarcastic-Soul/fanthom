"""Turn word timings into transcript lines (utterances) and speaker stats.

AMI: reads the manual word annotations (one XML file per speaker).
YouTube: reads the cached AssemblyAI result.

Writes $SEED_WORK_DIR/shaped/<key>.json with speakers + utterances.

Usage: python -I scripts/seed/shape.py [key ...]
"""

import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # find common.py when run with -I
from common import CACHE, MEETINGS, RAW, WORK, read_json, write_json

PAUSE_MS = 1500     # a silence longer than this starts a new line
SOFT_MAX_MS = 20000  # after this, break at the next sentence end
HARD_MAX_MS = 35000  # after this, break at the next word

AMI_ROLES = {"PM": "Project Manager", "ME": "Marketing Expert",
             "UI": "User Interface Designer", "ID": "Industrial Designer"}

# Filler words dropped from the AMI text so lines read cleanly.
FILLERS = {"um", "uh", "uhm", "erm", "er", "mm", "hmm", "uh-huh", "mm-hmm", "um-hum"}

NITE = "{http://nite.sourceforge.net/}"


def audio_ms(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return int(float(out.stdout.strip()) * 1000)


def ami_words(key):
    """Words per speaker letter as (start_ms, end_ms, text, is_punct)."""
    ann = RAW / "ami" / "ann"
    per_speaker = {}
    for letter in "ABCDE":
        path = ann / "words" / f"{key}.{letter}.words.xml"
        if not path.exists():
            continue
        words = []
        for el in ET.parse(path).getroot():
            if el.tag != "w" or el.get("starttime") is None or not el.text:
                continue
            if el.get("trunc") == "true":
                continue  # cut-off word fragments like "des-"
            words.append((int(float(el.get("starttime")) * 1000), int(float(el.get("endtime")) * 1000),
                          el.text.strip(), el.get("punc") == "true"))
        per_speaker[letter] = words
    return per_speaker


def ami_roles(key):
    root = ET.parse(RAW / "ami" / "ann" / "corpusResources" / "meetings.xml").getroot()
    for meeting in root:
        if meeting.get("observation") == key:
            return {s.get("nxt_agent"): AMI_ROLES[s.get("role")] for s in meeting}
    raise KeyError(key)


def join_ami(words):
    """Join AMI tokens into readable text: drop fillers, attach punctuation."""
    out = []
    dropped_last = False
    for _, _, text, punc in words:
        if punc:
            if out and not dropped_last and not out[-1].endswith(tuple(".,?!")):
                out[-1] += text
            continue
        if text.lower().strip(".,") in FILLERS:
            dropped_last = True
            continue
        dropped_last = False
        out.append(text)
    s = " ".join(out).strip(" ,")
    if not s:
        # A line that was only "Mm-hmm" stays as a short acknowledgement.
        only = [w[2] for w in words if not w[3]]
        s = only[0] if only else ""
    if s and s[-1].isalnum():
        s += "."
    return s[:1].upper() + s[1:]


def segment(words, ends_sentence):
    """Split one speaker's stream of words into lines by pause and length."""
    lines, cur = [], []
    for w in words:
        if cur:
            gap = w[0] - cur[-1][1]
            length = cur[-1][1] - cur[0][0]
            if (gap > PAUSE_MS or length > HARD_MAX_MS
                    or (length > SOFT_MAX_MS and ends_sentence(cur[-1]) and not w[3])):
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def shape_ami(key):
    roles = ami_roles(key)
    utts = []
    for letter, words in ami_words(key).items():
        words.sort(key=lambda w: w[0])
        for line in segment(words, lambda w: w[2] in (".", "?", "!")):
            text = join_ami(line)
            if not text or all(w[3] for w in line):
                continue
            real = [w for w in line if not w[3]]
            utts.append({"speaker": letter, "start_ms": real[0][0], "end_ms": max(w[1] for w in real), "text": text})
    speakers = [{"label": k, "name": v, "role": v} for k, v in sorted(roles.items())]
    return speakers, utts, audio_ms(RAW / "ami" / f"{key}.wav")


def shape_youtube(key):
    res = read_json(CACHE / "assemblyai" / f"{key}.json")
    # One stream of words; a speaker change also starts a new line.
    utts, cur = [], []

    def flush():
        if cur:
            text = " ".join(w["text"] for w in cur).strip()
            utts.append({"speaker": cur[0]["speaker"], "start_ms": cur[0]["start"],
                         "end_ms": cur[-1]["end"], "text": text})
            cur.clear()

    for w in res["words"]:
        if cur:
            gap = w["start"] - cur[-1]["end"]
            length = cur[-1]["end"] - cur[0]["start"]
            if (w["speaker"] != cur[0]["speaker"] or gap > PAUSE_MS or length > HARD_MAX_MS
                    or (length > SOFT_MAX_MS and re.search(r"[.?!]$", cur[-1]["text"]))):
                flush()
        cur.append(w)
    flush()
    labels = sorted({u["speaker"] for u in utts})
    speakers = [{"label": k, "name": f"Speaker {k}", "role": None} for k in labels]
    return speakers, utts, int(res["audio_duration"] * 1000)


def finish(speakers, utts):
    """Sort lines, number them, and add talk time, turns and colours."""
    utts.sort(key=lambda u: (u["start_ms"], u["end_ms"]))
    for i, u in enumerate(utts):
        u["idx"] = i
        u["end_ms"] = max(u["end_ms"], u["start_ms"] + 1)
    stats = {s["label"]: {"talk_ms": 0, "turns": 0} for s in speakers}
    prev = None
    for u in utts:
        stats[u["speaker"]]["talk_ms"] += u["end_ms"] - u["start_ms"]
        if u["speaker"] != prev:
            stats[u["speaker"]]["turns"] += 1
        prev = u["speaker"]
    speakers = [s for s in speakers if stats[s["label"]]["talk_ms"] > 0]
    for s in speakers:
        s.update(stats[s["label"]])
    speakers.sort(key=lambda s: -s["talk_ms"])
    for i, s in enumerate(speakers):
        s["color"] = i
    return speakers, utts


def main(keys):
    for m in MEETINGS:
        if keys and m["key"] not in keys:
            continue
        speakers, utts, duration = (shape_ami if m["source"] == "ami" else shape_youtube)(m["key"])
        speakers, utts = finish(speakers, utts)
        write_json(WORK / "shaped" / f"{m['key']}.json",
                   {"key": m["key"], "source": m["source"], "duration_ms": duration,
                    "speakers": speakers, "utterances": utts})
        print(m["key"], len(speakers), "speakers", len(utts), "lines", duration // 60000, "min")


if __name__ == "__main__":
    main(sys.argv[1:])
