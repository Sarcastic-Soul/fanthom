#!/usr/bin/env python3
"""8x agent capture hook for Claude Code.

Wired to SessionStart, UserPromptSubmit and Stop in .claude/settings.json. Appends the
verbatim prompt and the final response of every turn to
.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md in the 8x log format.

Never blocks the session: any error is written to .claude/hooks/.state/errors.log
and the hook exits 0.
"""
import fcntl
import glob
import json
import os
import sys
import traceback
from datetime import datetime, timezone

AUTHOR = "Sarcastic-Soul"
TOOL = "claude-code"
PROJECT = "fanthom-rebuild"

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
LOG_DIR = os.path.join(ROOT, ".agent-logs")
STATE_DIR = os.path.join(ROOT, ".claude", "hooks", ".state")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_state(session_id):
    path = os.path.join(STATE_DIR, f"{session_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {
        "prompt_num": 0,
        "response_num": 0,
        "model": "unknown",
        "first_prompt_time": None,
        "last_prompt_time": None,
        "log_file": None,
    }


def save_state(session_id, state):
    with open(os.path.join(STATE_DIR, f"{session_id}.json"), "w") as f:
        json.dump(state, f, indent=2)


def log_path(session_id, state):
    if state["log_file"]:
        return os.path.join(LOG_DIR, state["log_file"])
    existing = glob.glob(os.path.join(LOG_DIR, f"*_{session_id}.md"))
    if existing:
        name = os.path.basename(existing[0])
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        name = f"{stamp}_{session_id}.md"
    state["log_file"] = name
    return os.path.join(LOG_DIR, name)


def header(session_id, state):
    date = (state["first_prompt_time"] or now_iso())[:10]
    return (
        "---\n"
        f"session_id: {session_id}\n"
        f"date: {date}\n"
        f"author: {AUTHOR}\n"
        f"model: {state['model']}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT}\n"
        f"total_exchanges: {state['prompt_num']}\n"
        f"first_prompt_time: {state['first_prompt_time']}\n"
        f"last_prompt_time: {state['last_prompt_time']}\n"
        "---\n"
    )


def write_log(path, session_id, state, entry):
    """Rewrite only the frontmatter (counters), then append the new entry."""
    short = session_id[:8]
    if os.path.exists(path):
        with open(path) as f:
            body = f.read()
        # Frontmatter is the first block between '---' lines; entries come after it.
        end = body.index("\n---\n", 4) + len("\n---\n")
        body = header(session_id, state) + body[end:]
    else:
        date = (state["first_prompt_time"] or now_iso())[:10]
        body = (
            header(session_id, state)
            + f"\n# Session Log - {date}\n\n"
            + f"Session: `{short}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n\n---\n"
        )
    body += entry
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(body)
    os.replace(tmp, path)


def entry(kind, num, session_id, timestamp, model, text):
    return (
        f"\n[LOG_ENTRY type={kind} num={num} session={session_id[:8]}]\n"
        f"timestamp: {timestamp}\n"
        f"model: {model}\n\n"
        f"{text}\n"
    )


def model_from_transcript(transcript_path):
    """Model of the last assistant message in the session transcript, if any."""
    if not transcript_path or not os.path.exists(transcript_path):
        return None
    model = None
    with open(transcript_path) as f:
        for line in f:
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            msg = rec.get("message") if isinstance(rec, dict) else None
            if rec.get("type") == "assistant" and isinstance(msg, dict) and msg.get("model"):
                if msg["model"] != "<synthetic>":
                    model = msg["model"]
    return model


def last_text_from_transcript(transcript_path):
    """Fallback when the Stop payload has no last_assistant_message."""
    if not transcript_path or not os.path.exists(transcript_path):
        return None
    text = None
    with open(transcript_path) as f:
        for line in f:
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            msg = rec.get("message") if isinstance(rec, dict) else None
            if rec.get("type") != "assistant" or not isinstance(msg, dict):
                continue
            parts = [
                b.get("text", "")
                for b in msg.get("content") or []
                if isinstance(b, dict) and b.get("type") == "text"
            ]
            if any(p.strip() for p in parts):
                text = "\n".join(parts)
    return text


def on_session_start(data, state):
    """UserPromptSubmit carries no model field, so remember it from SessionStart."""
    if data.get("model"):
        state["model"] = data["model"]


def on_prompt(data, state, path):
    sid = data["session_id"]
    ts = now_iso()
    # Last model that answered in this session wins (catches a /model switch).
    model = data.get("model") or model_from_transcript(data.get("transcript_path"))
    if model:
        state["model"] = model
    entries = ""
    # Previous turn never reached Stop (interrupted with Esc, crash, etc.).
    if state["prompt_num"] > state["response_num"]:
        entries += entry(
            "RESPONSE", state["prompt_num"], sid, ts, state["model"],
            "(no final response captured: turn was interrupted before it finished)",
        )
        state["response_num"] = state["prompt_num"]
    state["prompt_num"] += 1
    state["first_prompt_time"] = state["first_prompt_time"] or ts
    state["last_prompt_time"] = ts
    entries += entry("PROMPT", state["prompt_num"], sid, ts, state["model"], data.get("prompt", ""))
    write_log(path, sid, state, entries)


def on_stop(data, state, path):
    sid = data["session_id"]
    if state["prompt_num"] == 0:
        return
    transcript = data.get("transcript_path")
    model = model_from_transcript(transcript) or state["model"]
    state["model"] = model
    text = data.get("last_assistant_message")
    if text is None:
        text = last_text_from_transcript(transcript)
    if text is None:
        text = "(no response text found)"
    state["response_num"] = state["prompt_num"]
    write_log(path, sid, state, entry("RESPONSE", state["prompt_num"], sid, now_iso(), model, text))


def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    os.makedirs(STATE_DIR, exist_ok=True)
    data = json.load(sys.stdin)
    sid = data["session_id"]
    event = data.get("hook_event_name")
    with open(os.path.join(STATE_DIR, f"{sid}.lock"), "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = load_state(sid)
        path = log_path(sid, state)
        if event == "SessionStart":
            on_session_start(data, state)
        elif event == "UserPromptSubmit":
            on_prompt(data, state, path)
        elif event == "Stop":
            on_stop(data, state, path)
        save_state(sid, state)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(os.path.join(STATE_DIR, "errors.log"), "a") as f:
            f.write(f"{now_iso()}\n{traceback.format_exc()}\n")
    sys.exit(0)
