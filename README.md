# Fanthom

A rebuild of [fathom.video](https://fathom.video), the AI meeting notetaker, made for the 8x
Software Engineer take-home.

**Live:** https://fanthom-six.vercel.app (no sign-in, opens straight into a demo workspace)

The demo workspace holds nine real recorded meetings, 6.1 hours in all. The one to open first is
[Plan team weekly sync](https://fanthom-six.vercel.app/meetings/plan-team-weekly-sync): 56
minutes, 8 speakers.

## What I built, and why in this order

The brief says the 8-person, 1-hour call is the case that matters. On that call nobody wants to
watch the recording again. They want the outcome in two minutes and a fast way to check the one
moment that matters. So every screen is built around reading first and playing second.

1. **Meeting page.** Player and transcript stay in sync. Click any line to jump there. The
   current line is highlighted and the transcript follows the playhead until you scroll away,
   then a "Back to 18:24" button brings you back. Speakers each have a color.
2. **Who spoke when.** One lane per person across the whole hour, with each person's share of
   the talking. It is also the scrubber: click a lane to jump, click a name to hide that person
   in the transcript. On an 8-person call this tells you more at a glance than the video does.
3. **AI summary with six templates** (General, Project update, Standup, Retro, Sales, 1:1). The
   page opens on the template that best fits the meeting. Every bullet links to the moment it
   came from, so you can check the AI against the recording.
4. **Action items** with an owner and a link to the moment each was agreed. Ticking one off is
   kept in your browser only, so one visitor cannot change the demo for the next.
5. **Chapters**, shown in the summary, on the timeline and as headings inside the transcript.
6. **Search across all meetings** using Postgres full-text search. Results are grouped by
   meeting and jump to the exact second. There is also a find-in-meeting box with next and
   previous.
7. **Clips.** Select lines in the transcript and press Create clip. Each clip gets a public link
   (`/share/clip/<id>`) that plays only that part and stops at its end, for someone who was not
   on the call. A Clips page lists them all.
8. **Long-call details.** The transcript is virtualized so an hour of lines scrolls smoothly,
   there is a speaker filter, keyboard shortcuts (space, left and right arrows), playback speed,
   and `?t=<seconds>` links to any moment.

## What is stubbed, and why

Recording is the hard part of the real product and the least interesting part to judge in a day,
so I faked it and spent the time on what you do with a meeting after it ends. The app says so
wherever it comes up.

- **Recording bot.** No bot joins Zoom, Meet or Teams. Every meeting was recorded elsewhere and
  processed ahead of time by the scripts in `scripts/seed/`.
- **Calendar.** The Calendar page shows sample events with a "Notetaker joins" switch. There is
  no calendar connection, and the switches only remember your choice in your browser.
- **Upload.** "Add a recording" walks through the processing steps (upload, transcribe, write
  the summary) but the file never leaves your browser. Real processing costs API credits, and
  the demo should not depend on a free-tier quota.

Left out on purpose: sign-in and teams, CRM sync (HubSpot, Salesforce), billing, and editing
summaries by hand.

## Stack

- Next.js 16 (App Router) and TypeScript on Vercel
- Supabase: Postgres with full-text search, row-level security (anyone can read, writes go
  through server code), and Storage for the meeting audio
- AssemblyAI for transcripts with speaker labels
- Gemini (free tier) for titles, chapters, action items and the six summaries. Each summary
  records which model wrote it.
- `@tanstack/react-virtual` for the transcript, `motion` for the few animations, Phosphor icons

All of it runs on free tiers. The AI work happened once, offline, so visitors never hit a rate
limit.

## Run it locally

You need Node 22+, pnpm and a Supabase project.

```sh
pnpm install
cp .env.example .env.local            # fill in the Supabase URL and keys
supabase link --project-ref <ref>
supabase db push                      # creates the tables, search function and media bucket
python3 -I scripts/seed/load.py       # loads the committed meetings in seed/meetings/
python3 -I scripts/seed/clips.py      # adds two starter clips per meeting
pnpm dev
```

`load.py` uploads the AMI audio, which it builds with `fetch.py` first. To rebuild the seed data
from scratch (download, transcribe, summarize), see [`scripts/seed/README.md`](scripts/seed/README.md).

## Seed data credits

- **AMI Meeting Corpus**, meetings ES2002a to ES2002d, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Carletta, J. et al. (2005), "The
  AMI Meeting Corpus". Transcripts come from the corpus's own word-level annotations. The audio
  was converted to mono mp3. Speakers are named by their role in the design team.
- **GitLab's public meetings on YouTube** (GitLab Unfiltered). They play through the YouTube
  embed and are never re-hosted. Transcribed with AssemblyAI.
  - [GitLab 10.0 Release Retrospective](https://www.youtube.com/watch?v=BGnH10g-eZ0)
  - [Plan, 2021-07-07 Weekly Team Meeting](https://www.youtube.com/watch?v=UtOVYRBbNVw)
  - [Plan, Weekly Sync 2022-12-07](https://www.youtube.com/watch?v=uzcaqhUkBLU)
  - [Ops Cross-Stage Think Big, 2021-04-15](https://www.youtube.com/watch?v=JaYXLlXrfDM)
  - [General (CEO) GitLab Group Conversation, 2021-08-16](https://www.youtube.com/watch?v=HRWk_xeXc4Y)

Speaker first names on the GitLab meetings were only used where the transcript makes them
clear; everyone else stays "Speaker C" and so on. Meeting dates were moved into September and
October 2026 so the workspace looks current.

## Agent logs

Every prompt and final response from the coding agent is in [`.agent-logs/`](.agent-logs),
committed alongside the code it produced. [`CAPTURE-TEST.md`](CAPTURE-TEST.md) shows the capture
test passing before the build started.
