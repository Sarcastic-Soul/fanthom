# Seed data pipeline

Builds the demo workspace offline, so the live site never calls an AI or
transcription API for the seed meetings.

What it makes: `seed/meetings/<slug>.json`, one file per meeting with the
meeting row, speakers, transcript lines, chapters, action items and a summary
for every template. These files are committed. `load.py` puts them into Supabase.

## Meetings

- 4 meetings from the AMI Meeting Corpus (ES2002a-d, the same design team over
  four meetings). Licence: CC BY 4.0. Transcript comes from the AMI manual word
  annotations. Speakers are named by their role in the team. The audio is
  converted to a small mono mp3 and stored in the Supabase `media` bucket.
- 5 public GitLab meetings from YouTube. They play through the YouTube embed
  (we never re-host the video). The audio is transcribed with AssemblyAI
  (speaker labels on). Gemini only gives a speaker a first name when the
  transcript makes it clear; otherwise they stay "Speaker C".

The list of meetings and their made-up dates is in `common.py`.

## Rerun

Needs `uv`/Python 3, `ffmpeg`, `curl` and `yt-dlp` (`uv tool install yt-dlp`),
plus `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

Big files and API caches go in `$SEED_WORK_DIR` (default `/tmp/fanthom-seed`),
never in the repo. With the caches in place, every step can be rerun for free.

```sh
export SEED_WORK_DIR=/tmp/fanthom-seed
python3 -I scripts/seed/fetch.py       # AMI annotations + audio, YouTube audio + info
python3 -I scripts/seed/transcribe.py  # AssemblyAI, YouTube meetings only
python3 -I scripts/seed/shape.py       # word timings -> transcript lines + talk time
python3 -I scripts/seed/enrich.py      # Gemini: names, title, chapters, actions, summaries
python3 -I scripts/seed/load.py        # upload audio, replace rows in Supabase, check counts
```

Each script takes optional meeting keys (or slugs, for `load.py`) to run just
those. `load.py` alone is enough to reload the committed JSON into a fresh
database: it deletes each meeting by slug (rows cascade) and inserts it again.
For AMI meetings it also needs the mp3 files from `fetch.py`, unless they are
already in the bucket.

## Notes

- Transcript lines: a new line starts when the speaker changes, after a pause
  over 1.5 s, or once a turn runs past ~20 s (at a sentence end where possible).
- Speaker colours are 0..N-1 by talk time, most first.
- Gemini's free tier allows about 20 requests per model per day, so `enrich.py`
  makes one call per meeting (plus one for speaker names on YouTube meetings)
  and falls back through several flash models when one is busy or out of quota.
  The model that wrote each summary is stored in `summaries.model`.
