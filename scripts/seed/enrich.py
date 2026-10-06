"""Add the AI layer with Gemini and write seed/meetings/<slug>.json.

For each shaped meeting:
  1. (YouTube only) guess real first names for speaker letters, only when clear.
  2. Title, meeting type, chapters and action items.
  3. One summary per template.

The model sees the transcript as numbered lines ("#12 [03:04] Name: text") and
answers with line numbers; we map those to start_ms here. Every Gemini answer
is cached in $SEED_WORK_DIR/cache/gemini/, so reruns cost nothing.

Usage: python -I scripts/seed/enrich.py [key ...]
"""

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # find common.py when run with -I
from common import CACHE, MEETINGS, RAW, SEED_DIR, WORK, fmt_ts, load_env, read_json, write_json

# Tried in order. gemini-2.5-flash is closed to new keys, so newer flash models
# come after gemini-flash-latest as fallbacks.
MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.7-flash", "gemini-3.6-flash",
          "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash",
          # Last resort: lighter models with their own daily quota.
          "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]
MEETING_TYPES = ["general", "project_update", "standup", "retro", "sales", "one_on_one"]

TEMPLATES = {
    "general": ["Meeting purpose", "Key takeaways", "Topics", "Next steps"],
    "project_update": ["Progress", "Blockers", "Decisions", "Next steps"],
    "standup": ["Yesterday / done", "Today / planned", "Blockers"],
    "retro": ["What went well", "What didn't", "Ideas to improve"],
    "sales": ["Prospect needs", "Objections", "Budget & timeline", "Next steps"],
    "one_on_one": ["Wins", "Concerns", "Feedback", "Follow-ups"],
}

AMI_PHASES = {
    "a": "meeting 1 of 4, the project kickoff",
    "b": "meeting 2 of 4, the functional design meeting",
    "c": "meeting 3 of 4, the conceptual design meeting",
    "d": "meeting 4 of 4, the detailed design meeting",
}

STYLE = ("Write in plain, simple English. No hype, no marketing words. "
         "Only state things that are said in the transcript; never invent facts, names, numbers or dates.")

# Checked by hand after reading the transcript and the model's evidence.
# None means "keep Speaker X": the evidence pointed at someone else.
NAME_OVERRIDES = {"HRWk_xeXc4Y": {"E": None}}

# Names the transcription got wrong, fixed everywhere in the final file.
TEXT_FIXES = {"HRWk_xeXc4Y": {"Sid Sivaramani": "Sid Sijbrandij", "Syd": "Sid"}}

# Titles picked by hand where the model's title was off.
TITLE_OVERRIDES = {"HRWk_xeXc4Y": "GitLab CEO group conversation", "uzcaqhUkBLU": "Plan team weekly sync"}

used_models = set()
dead_models = set()


# ---------- Gemini ----------

def gemini(prompt, schema):
    """Call Gemini with a JSON schema. Cached on disk by prompt + schema."""
    key = hashlib.sha256(json.dumps([prompt, schema], sort_keys=True).encode()).hexdigest()[:24]
    path = CACHE / "gemini" / f"{key}.json"
    if path.exists():
        hit = read_json(path)
        used_models.add(hit["model"])
        return hit["data"], hit["model"]
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema},
    }
    # Free-tier models are often "overloaded" (503) for a few seconds at a
    # time. Go round the model list, moving on at once on a 503, and pause
    # between rounds. A model that is gone (404) or out of daily quota is dropped.
    for round_no in range(8):
        for model in MODELS:
            if model in dead_models:
                continue
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
                "content-type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    res = json.loads(r.read())
                text = "".join(p.get("text", "") for p in res["candidates"][0]["content"]["parts"])
                data = json.loads(text)
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")
                if e.code == 404 or (e.code == 429 and "PerDay" in msg):
                    print(f"  {model} {e.code}, dropping it: {msg[:160]!r}")
                    dead_models.add(model)
                elif e.code == 429:
                    print(f"  {model} 429 (per-minute limit)")
                    time.sleep(10)
                elif e.code >= 500:
                    print(f"  {model} {e.code} (busy)")
                    time.sleep(5)
                else:
                    print(f"  {model} {e.code}: {msg[:160]!r}")
                continue
            except (KeyError, IndexError, json.JSONDecodeError, TimeoutError, urllib.error.URLError) as e:
                print(f"  {model} bad answer ({type(e).__name__})")
                continue
            write_json(path, {"model": model, "data": data})
            used_models.add(model)
            return data, model
        wait = 30 + 15 * round_no
        print(f"  no model answered (round {round_no + 1}), waiting {wait}s")
        time.sleep(wait)
    raise RuntimeError("all Gemini models failed")


# ---------- helpers ----------

def numbered(utts, names):
    return "\n".join(f"#{u['idx']} [{fmt_ts(u['start_ms'])}] {names[u['speaker']]}: {u['text']}" for u in utts)


def line_ms(utts, line):
    if line is None:
        return None
    line = max(0, min(int(line), len(utts) - 1))
    return utts[line]["start_ms"]


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:70].strip("-")


def context_for(m):
    if m["source"] == "ami":
        return ("This is a meeting from the AMI Meeting Corpus. It is a role-play: a four-person product "
                "design team at a made-up electronics company is designing a new TV remote control. "
                f"This is {AMI_PHASES[m['key'][-1]]}. Speakers are named by their role in the team.")
    info = read_json(RAW / "yt" / f"{m['key']}.info.json")
    desc = (info.get("description") or "").strip()[:600]
    return (f"This is a real internal GitLab meeting that GitLab published on YouTube.\n"
            f"YouTube title: {info['title']}\nYouTube description: {desc or '(none)'}")


# ---------- steps ----------

def name_speakers(m, shaped):
    """Ask for first names of YouTube speakers. Keep 'Speaker X' when unsure."""
    labels = {s["label"]: f"Speaker {s['label']}" for s in shaped["speakers"]}
    talk = ", ".join(f"Speaker {s['label']} ({s['talk_ms'] // 60000} min, {s['turns']} turns)" for s in shaped["speakers"])
    prompt = f"""{context_for(m)}

Below is the transcript. Speakers were detected automatically and labelled with letters: {talk}.
Your job: find the real first name of each speaker, but ONLY when the transcript gives clear evidence, for example:
- they introduce themselves ("Hi, I'm Sam", "this is Sam from ..."),
- the previous speaker hands over to them by name ("Over to you, Sam") and they then start talking,
- someone answers them by name right after they speak in a way that clearly refers to them.
If the evidence is weak, indirect or conflicting, return null for that speaker. Being wrong is much worse than leaving a name out.
Never give the same name to two speakers. Give only the first name as spoken (fix obvious spelling if a name repeats differently).
For each speaker give a short quote of the evidence with its line number.

Transcript:
{numbered(shaped['utterances'], labels)}
"""
    schema = {"type": "OBJECT", "properties": {"speakers": {"type": "ARRAY", "items": {
        "type": "OBJECT", "properties": {
            "label": {"type": "STRING", "enum": sorted(labels)},
            "name": {"type": "STRING", "nullable": True},
            "evidence": {"type": "STRING"}},
        "required": ["label", "name", "evidence"]}}}, "required": ["speakers"]}
    data, _ = gemini(prompt, schema)
    names, seen = {}, set()
    talk_ms = {s["label"]: s["talk_ms"] for s in shaped["speakers"]}
    for s in sorted(data["speakers"], key=lambda s: -talk_ms.get(s["label"], 0)):
        name = (s.get("name") or "").strip()
        if s["label"] in labels and name and name.lower() not in seen and not name.lower().startswith("speaker"):
            names[s["label"]] = name
            seen.add(name.lower())
    return names, data["speakers"]


def analyze(m, shaped, names):
    """One call per meeting for title, type, chapters, action items and every
    summary template. The free tier allows only ~20 requests per model per
    day, so we keep the number of calls as small as we can."""
    template_text = "\n".join(f'  - {t}: sections {json.dumps(h)}' for t, h in TEMPLATES.items())
    prompt = f"""{context_for(m)}

{STYLE}

Read the meeting transcript below. Each line starts with its line number, like #12.
Return:
- title: a short, specific meeting title, 3 to 8 words, like a calendar entry someone would actually write (for example "Remote control kickoff" or "Plan team weekly sync"). No dates, no quotes.
- meeting_type: the one type that best describes the meeting: {", ".join(MEETING_TYPES)}.
- chapters: 4 to 10 chapters that cover the whole meeting in order. Each has a short title (2 to 6 words), the line number where it starts, and a one-sentence gist. The first chapter starts at line 0.
- action_items: 3 to 12 concrete next steps that someone agreed to or was asked to do. Each has the task in one short sentence starting with a verb, the owner (a speaker name exactly as written in the transcript, or null if nobody clear owns it), and the line number where it was said.
- summaries: one summary for EACH of these templates, using exactly these section headings in this order:
{template_text}
  Each summary has a tldr (2 to 3 sentences on what the meeting was about and what came out of it, written for that template's angle) and its sections.
  Each section has 1 to 6 bullets. Each bullet is one short sentence grounded in the transcript, with the line number that best supports it.
  Some templates will not fit this meeting (for example "sales" on an internal call). Then keep it honest: if a section has nothing real to report, give one bullet saying so (for example "No budget was discussed.") with line null. Do not stretch or invent content to fill a section.
  Refer to people by the speaker names used in the transcript.

Transcript:
{numbered(shaped['utterances'], names)}
"""
    bullet = {"type": "OBJECT", "properties": {
        "text": {"type": "STRING"}, "line": {"type": "INTEGER", "nullable": True}}, "required": ["text", "line"]}

    def summary_schema(headings):
        return {"type": "OBJECT", "properties": {
            "tldr": {"type": "STRING"},
            "sections": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                "heading": {"type": "STRING", "enum": headings},
                "bullets": {"type": "ARRAY", "items": bullet}}, "required": ["heading", "bullets"]}},
        }, "required": ["tldr", "sections"]}

    schema = {"type": "OBJECT", "properties": {
        "title": {"type": "STRING"},
        "meeting_type": {"type": "STRING", "enum": MEETING_TYPES},
        "chapters": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "title": {"type": "STRING"}, "line": {"type": "INTEGER"}, "gist": {"type": "STRING"}},
            "required": ["title", "line", "gist"]}},
        "action_items": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "text": {"type": "STRING"}, "owner_name": {"type": "STRING", "nullable": True}, "line": {"type": "INTEGER"}},
            "required": ["text", "owner_name", "line"]}},
        "summaries": {"type": "OBJECT", "properties": {t: summary_schema(h) for t, h in TEMPLATES.items()},
                      "required": list(TEMPLATES)},
    }, "required": ["title", "meeting_type", "chapters", "action_items", "summaries"]}
    return gemini(prompt, schema)


# ---------- main ----------

def enrich(m):
    shaped = read_json(WORK / "shaped" / f"{m['key']}.json")
    utts = shaped["utterances"]
    names = {s["label"]: s["name"] for s in shaped["speakers"]}
    if m["source"] == "youtube":
        found, evidence = name_speakers(m, shaped)
        for label, name in NAME_OVERRIDES.get(m["key"], {}).items():
            found.pop(label, None)
            if name:
                found[label] = name
        names.update(found)
        write_json(WORK / "names" / f"{m['key']}.json", evidence)
        print(m["key"], "names:", found)
    meta, model = analyze(m, shaped, names)
    meta["title"] = TITLE_OVERRIDES.get(m["key"], meta["title"])
    print(m["key"], "title:", meta["title"])

    duration = shaped["duration_ms"]
    chapters = sorted({c["line"]: c for c in meta["chapters"]}.values(), key=lambda c: c["line"])
    rows = []
    for i, c in enumerate(chapters):
        start = 0 if i == 0 else line_ms(utts, c["line"])
        rows.append({"idx": i, "title": c["title"], "start_ms": start, "gist": c["gist"], "line": c["line"]})
    for i, r in enumerate(rows):
        r["end_ms"] = rows[i + 1]["start_ms"] if i + 1 < len(rows) else duration

    label_by_name = {v: k for k, v in names.items()}
    actions = [{"idx": i, "text": a["text"], "owner_name": a["owner_name"],
                "speaker_label": label_by_name.get(a["owner_name"]),
                "ts_ms": line_ms(utts, a["line"]), "line": a["line"]}
               for i, a in enumerate(meta["action_items"])]
    for a in actions:
        if a["owner_name"] and not a["speaker_label"]:
            a["owner_name"] = None  # owner must be someone in the transcript

    summaries = []
    for template in TEMPLATES:
        content = meta["summaries"][template]
        order = {h: i for i, h in enumerate(TEMPLATES[template])}
        content["sections"] = sorted(content["sections"], key=lambda s: order.get(s["heading"], 99))
        for sec in content["sections"]:
            for b in sec["bullets"]:
                b["ts_ms"] = line_ms(utts, b.get("line"))
        summaries.append({"template": template, "content": content, "model": model})

    speakers = [{**s, "name": names[s["label"]]} for s in shaped["speakers"]]
    if m["source"] == "ami":
        media = {"media_type": "audio", "media_path": f"ami/{m['key']}.mp3", "youtube_id": None,
                 "source_name": "AMI Meeting Corpus", "source_url": "https://groups.inf.ed.ac.uk/ami/corpus/",
                 "credit": f"AMI Meeting Corpus, CC BY 4.0 (meeting {m['key']})"}
    else:
        info = read_json(RAW / "yt" / f"{m['key']}.info.json")
        url = f"https://www.youtube.com/watch?v={m['key']}"
        media = {"media_type": "youtube", "media_path": None, "youtube_id": m["key"],
                 "source_name": "GitLab on YouTube", "source_url": url,
                 "credit": f"GitLab on YouTube: \"{info['title']}\" {url}"}

    doc = {
        "meeting": {"slug": slugify(meta["title"]), "title": meta["title"], "started_at": m["started_at"],
                    "duration_ms": duration, **media, "kind": "demo", "status": "ready",
                    "meeting_type": meta["meeting_type"]},
        "speakers": speakers,
        "utterances": [{"idx": u["idx"], "speaker": u["speaker"], "start_ms": u["start_ms"],
                        "end_ms": u["end_ms"], "text": u["text"]} for u in utts],
        "chapters": rows,
        "action_items": actions,
        "summaries": summaries,
    }
    text = json.dumps(doc, ensure_ascii=False)
    for wrong, right in TEXT_FIXES.get(m["key"], {}).items():
        text = text.replace(wrong, right)
    return json.loads(text)


def main(keys):
    load_env()
    todo = [m for m in MEETINGS if not keys or m["key"] in keys]
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(enrich, todo))
    # Make slugs unique across the whole set, then write one file per meeting.
    existing = {read_json(p)["meeting"]["slug"]: p for p in SEED_DIR.glob("*.json")}
    for m, doc in zip(todo, results):
        doc["meeting"]["source_key"] = m["key"]
        slug = doc["meeting"]["slug"]
        if slug in existing and read_json(existing[slug])["meeting"].get("source_key") != m["key"]:
            # Same title as another meeting (a recurring meeting): add the date.
            slug = f"{slug}-{m['started_at'][:10]}"
        doc["meeting"]["slug"] = slug
        for old in SEED_DIR.glob("*.json"):  # drop an older file for the same meeting
            if read_json(old)["meeting"].get("source_key") == m["key"] and old.stem != slug:
                old.unlink()
        write_json(SEED_DIR / f"{slug}.json", doc)
        existing[slug] = SEED_DIR / f"{slug}.json"
        print("wrote", slug)
    print("models used:", sorted(used_models))


if __name__ == "__main__":
    main(sys.argv[1:])
