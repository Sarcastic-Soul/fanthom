# Brief for the three meeting-page options

Each option is ONE self-contained static HTML file showing the **meeting page** of Fanthom, a
rebuild of fathom.video (AI meeting notetaker). Read `docs/DESIGN-DIRECTION.md` first.

## Mock meeting (same content in all three options)

"Plan stage weekly sync", Tue 29 Sep 2026, 10:00, 52 min, 8 speakers:
Priya (PM, talks most), Marcus (eng manager), Elena (backend), Tomás (frontend), Aiko (design),
Dev (QA), Sam (data), Grace (support). Topics: release 17.5 scope, a flaky CI pipeline,
a customer escalation about merge request approvals, design review of the new approvals
sidebar, on-call rota. Write realistic, specific content (real-sounding numbers, ticket ids,
decisions). Around 25 transcript lines visible, timestamps mm:ss or h:mm:ss.

## Every option must show

- App frame: slim left nav (Meetings, Search, Clips, Calendar) + workspace name
  "Demo workspace" + a quiet note "Public demo, no sign-in".
- Header: title, date, duration, participant avatars/initials, actions (Share, Copy summary).
- Player area (video poster: a grid of 8 muted speaker tiles, play controls, current time).
- **Speaker timeline**: one horizontal lane per speaker across the full 52 min, segments where
  they spoke, a playhead, chapter ticks. Talk-time % per speaker next to each lane.
- AI summary with a **template switcher** (General, Project update, Standup, Retro, Sales,
  1:1). Bullets with a small timestamp link each.
- Action items: checkbox, text, owner, timestamp.
- Chapters list.
- Transcript: speaker name + color, timestamp, text; the current line highlighted; one line
  showing a saved highlight; a selection popover "Create clip".
- Search in this meeting (input) and filter by speaker.
- Must work at 1440px and at 390px wide (phone layout can stack and use tabs).

## Constraints

- Follow `~/.claude/skills/design-guardrails/SKILL.md` banned list strictly.
- Icons: Phosphor web icons from https://unpkg.com/@phosphor-icons/web (one weight).
- Fonts from Google Fonts only. Plain CSS (or Tailwind CDN). No images from the web; the
  video poster is drawn with CSS.
- A little interactivity is welcome (template tabs switch content, clicking a line moves the
  playhead) but static is fine.
- Plain English copy. No marketing words.
