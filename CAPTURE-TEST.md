# Capture test

## Tool and model

- Tool: Claude Code CLI 2.1.291, on Linux.
- Model: Opus 5.5 (`claude-opus-5-5`). The same model plans and writes code. There is no separate planner model.

## Mechanism

Claude Code hooks, set in `.claude/settings.json`. Three events run the same script, `.claude/hooks/capture.py`:

- `SessionStart` saves the session's model, so the first prompt of a session is not logged as `model: unknown`.
- `UserPromptSubmit` appends the prompt, word for word, with a UTC timestamp and the model.
- `Stop` appends the final response for the turn. It reads `last_assistant_message`, and falls back to the transcript at `transcript_path`.

The hook keeps its working state in `.claude/hooks/.state/`, which is gitignored. `.agent-logs/` is not ignored and is committed with the code.

Files changed: `.claude/settings.json`, `.claude/hooks/capture.py`.

## Where the canaries landed

Each session gets its own log file:

- Canary 1 (first session, `bbb67df8`): `.agent-logs/2026-10-06_14-37-10_bbb67df8-e071-4c79-bb74-e9c39fd8506e.md`, as PROMPT 2 and RESPONSE 2. Prompt 1 of that session was the setup brief.
- Canary 2 (second session, `451f4b14`, started fresh after `/exit`): `.agent-logs/2026-10-06_14-40-30_451f4b14-1c50-4b6f-bf35-e9b2b0e26546.md`, as PROMPT 1 and RESPONSE 1.

Canary 2 is the first prompt of a new session and shows `model: claude-opus-5-5`, so the `SessionStart` hook works across sessions, not only in the session that set it up.

## Canary 1, raw

~~~~
[LOG_ENTRY type=PROMPT num=2 session=bbb67df8]
timestamp: 2026-10-06T14:40:04.335Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Anish Kumar

[LOG_ENTRY type=RESPONSE num=2 session=bbb67df8]
timestamp: 2026-10-06T14:40:13.312Z
model: claude-opus-5-5

Canary 1 is in the log, in `.agent-logs/2026-10-06_14-37-10_bbb67df8-e071-4c79-bb74-e9c39fd8506e.md`:

```
[LOG_ENTRY type=PROMPT num=2 session=bbb67df8]
timestamp: 2026-10-06T14:40:04.335Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Anish Kumar
```

- My whole reply to your first prompt (RESPONSE 1) was saved.
- This prompt shows `model: claude-opus-5-5` instead of `unknown`, so the fix that reads the model from the transcript works in a real session, not only in my test.
- The error log is empty.
- This reply will be added as RESPONSE 2 when the turn ends.

Next:
1. Type `/exit`, then run `claude` in `/home/anish-kumar/Code/fanthom`.
2. Send `CAPTURE TEST — 8x assignment, Anish Kumar` again.
3. Then ask for `CAPTURE-TEST.md`.

The second session will get its own log file. I'll check that it was created and that its first prompt shows the model, which tests the `SessionStart` hook. Then I'll write `CAPTURE-TEST.md` with both canary entries pasted raw and commit it.
~~~~

## Canary 2, raw

~~~~
[LOG_ENTRY type=PROMPT num=1 session=451f4b14]
timestamp: 2026-10-06T14:40:31.109Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Anish Kumar

[LOG_ENTRY type=RESPONSE num=1 session=451f4b14]
timestamp: 2026-10-06T14:40:46.899Z
model: claude-opus-5-5

Capture test worked. Prompt logged to `.agent-logs/2026-10-06_14-40-30_451f4b14-1c50-4b6f-bf35-e9b2b0e26546.md` as PROMPT #1, session `451f4b14`, model `claude-opus-5-5`, author `Sarcastic-Soul`. Stop hook will add this reply as RESPONSE #1 when turn ends.

Remaining before build:
- Second canary session still needed. Only other log is `bbb67df8` (setup session), not a canary.
- `CAPTURE-TEST.md` not in repo root yet (`docs/PLAN.md:52`).

Next: run second canary in fresh session, then say go and I'll write `CAPTURE-TEST.md` pointing at both logs and commit it with `.agent-logs/`.
~~~~

## What did not work first

1. **`model: unknown` on prompts.** The `UserPromptSubmit` hook input has no model field, so the first prompt of the setup session was logged as `model: unknown`. Fix: a `SessionStart` hook now saves the model, and each prompt entry also reads the latest model from the transcript, so a `/model` switch partway through shows up. The old `unknown` entry was left as it was.
2. **A broken test, not a broken hook.** The first test run of the hook, using fake event data, failed. The cause was zsh's `echo` turning `\n` into a real newline, which broke the JSON input. The hook itself was fine.
3. **A wrong claim from the agent.** In the second session, my reply to canary 2 said the second canary was "still needed" and that the first session had no canary. That was wrong: canary 1 was PROMPT 2 of the first session. I had only checked the first session's opening entry. The mistake is still in the log, unedited.
