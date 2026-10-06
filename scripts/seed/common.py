"""Shared helpers for the seed pipeline: paths, secrets, the list of meetings."""

import json
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SEED_DIR = REPO / "seed" / "meetings"

# Big files (audio, zips, API caches) live outside the repo.
WORK = Path(os.environ.get("SEED_WORK_DIR", "/tmp/fanthom-seed"))
RAW = WORK / "seed-raw"
CACHE = WORK / "cache"

AMI_MIRROR = "https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus"
AMI_ANNOTATIONS = "https://groups.inf.ed.ac.uk/ami/AMICorpusAnnotations/ami_public_manual_1.6.2.zip"

# The meetings we seed. started_at is a fixed, made-up date in the three
# weeks before 2026-10-06 so the list looks like a real workspace.
MEETINGS = [
    # AMI ES2002: the same four-person design team over four meetings.
    {"key": "ES2002a", "source": "ami", "started_at": "2026-09-15T10:00:00+05:30"},
    {"key": "ES2002b", "source": "ami", "started_at": "2026-09-16T11:30:00+05:30"},
    {"key": "ES2002c", "source": "ami", "started_at": "2026-09-18T10:00:00+05:30"},
    {"key": "ES2002d", "source": "ami", "started_at": "2026-09-22T14:00:00+05:30"},
    # GitLab public meetings on YouTube.
    {"key": "BGnH10g-eZ0", "source": "youtube", "started_at": "2026-09-17T09:30:00-07:00"},
    {"key": "UtOVYRBbNVw", "source": "youtube", "started_at": "2026-09-23T08:00:00-07:00"},
    {"key": "JaYXLlXrfDM", "source": "youtube", "started_at": "2026-09-29T10:00:00-07:00"},
    {"key": "uzcaqhUkBLU", "source": "youtube", "started_at": "2026-10-01T09:00:00-07:00"},
    {"key": "HRWk_xeXc4Y", "source": "youtube", "started_at": "2026-10-05T11:00:00-07:00"},
]


def load_env():
    """Read .env.local into os.environ without printing anything."""
    path = REPO / ".env.local"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False))


def fmt_ts(ms):
    s = ms // 1000
    return f"{s // 60:02d}:{s % 60:02d}" if s < 3600 else f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"
