# Build plan

Target: about 12–14 hours of build time, not the full 24. Speed is graded.

## The case that matters

The brief says the eight-person, one-hour call is "the case that actually matters". Every screen should be designed for that, not for a two-minute solo call:

- Many speakers: who said what, who talked how much, jump to a person.
- Long recordings: chapters, fast navigation, a transcript that stays smooth at 1 hour.
- Getting value without watching: good summary, action items with owners, search.

## Stack (free tier only)

- **Next.js (App Router) + TypeScript + Tailwind** on **Vercel**.
- **Supabase**: Postgres, Storage for media, Postgres full-text search (`tsvector`) for search across meetings.
- **Transcription with speaker labels**: Deepgram or AssemblyAI (both give free credits and do diarization). Groq Whisper does not label speakers, so it is not enough on its own.
- **LLM**: Gemini free tier, structured JSON output, for summaries per template, action items, chapters.
- Seed meetings are processed **once** by an offline script and stored, so the live demo never hits rate limits.

No login wall: visitors land in a public demo workspace that is already full of real meetings.

## Seed data (real, not lorem ipsum)

- AMI Meeting Corpus (real multi-speaker meetings with audio; check the license and credit it).
- GitLab's public team meetings on YouTube (long, many speakers).
- Optionally, a real call recorded with friends.

Aim for 6–10 meetings, at least one close to an hour with 6–8 speakers.

## Build order

1. **Deploy a skeleton first** (hour 1) so the live link is never a last-minute risk.
2. **Meeting page**: video/audio player synced to the transcript (click a line to seek, current line highlights and auto-scrolls), colour-coded speakers, talk-time bar per speaker.
3. **AI summary with template switcher** (General, Sales, 1:1, Standup, ...). Bullets link to timestamps. Cache output per template.
4. **Action items** with owner and timestamp, checkboxes.
5. **Meetings list + search across meetings**, results jump to the exact moment.
6. **Highlights and clips**: select transcript text to create a highlight/clip; public share page `/share/clip/[id]` plays only that range, works for someone not on the call.
7. **Long-call tools**: auto chapters, filter transcript by speaker, virtualized transcript, "jump to where X spoke".
8. **Stubbed capture layer**: upload a recording, show processing status, then done. A fake calendar list with a "notetaker joins" toggle. State clearly in the walkthrough that this is stubbed.

## Deliberately left out (say so in the walkthrough)

- Real recording bot joining Zoom/Meet/Teams.
- Real calendar OAuth.
- CRM integrations (HubSpot, Salesforce), billing, team admin.

## Hand-in checklist

- [ ] Live URL opens in a private window with no login, meetings list is full.
- [ ] Repo is public, `.agent-logs/` committed throughout (not one lump at the end).
- [ ] `CAPTURE-TEST.md` in repo root.
- [ ] README: what was built, what was stubbed and why, how to run, seed data credits.
- [ ] Walkthrough under 5 minutes, camera on, voiceover.
- [ ] 1-minute intro video.
