# Fanthom — fathom.video rebuild (8x take-home)

Rebuild of fathom.video (AI meeting notetaker) for an 8x Software Engineer application.
Due 2026-10-07 06:58 UTC. Full brief: `docs/BRIEF.md`. Build plan and priorities: `docs/PLAN.md`.

## Agent capture (do not break this)

- `.claude/settings.json` wires `UserPromptSubmit` and `Stop` to `.claude/hooks/capture.py`, which appends each prompt and final response to `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`.
- Never edit, tidy, or delete anything in `.agent-logs/`. Never add it to `.gitignore`.
- Commit `.agent-logs/` together with the code it produced, as you go.
- Do not start building until `CAPTURE-TEST.md` exists and both canary sessions are logged.

## Git

- Author: Sarcastic-Soul, `anishisbusy@gmail.com` (set as local repo config).
- Small, frequent commits. No co-author or "Generated with" lines.

## Product rules

- The live site must work for a visitor who is not signed in. Public demo workspace, no login wall.
- Seed with real meeting data. Never ship an empty state as the first thing a visitor sees.
- Design for the 8-person, 1-hour call first.
- Capture layer (recording bot, calendar OAuth) is stubbed on purpose. Keep the stubs honest in the UI copy.
- Free tiers only: Vercel, Supabase, Deepgram/AssemblyAI credits, Gemini free tier. Pre-process seed data offline so the demo never depends on API quotas.

## Writing

Plain English in the README, UI copy and commit messages.

@AGENTS.md
