# 90–180 second walkthrough plan

The required illustration video should be short enough to judge quickly and complete enough to prove the project is genuinely full stack. A target of **110–130 seconds** is comfortable.

A fresh account is ideal because one Hard quest awards enough XP to cross the first level threshold, so the recording can demonstrate signup, task creation, completion, level-up, and persistence without hidden setup.

## Suggested 120-second recording

| Time | Action | What the recording proves |
| --- | --- | --- |
| 0–10s | Open the deployed landing page and briefly show the product loop. | Public deployment is reachable. |
| 10–25s | Sign up and finish character onboarding. | Authentication and persisted character creation. |
| 25–45s | Open Quest Journal and create a **Hard** quest such as “Complete a focused coding session”, assigned to Intellect. | Real CRUD and attribute selection. |
| 45–65s | Complete the quest from Dashboard or Journal and confirm it. | Server-calculated reward transaction. |
| 65–78s | Let the XP/reward feedback finish and show the new level/Intellect progress. | Nonlinear progression and level-up. |
| 78–92s | Open Activity or Character and show the completion/streak/history. | Stored completion history and daily activity. |
| 92–108s | Refresh the browser on a private route such as `/character` or `/quests`. | Direct-route handling and database persistence after refresh. |
| 108–120s | Sign out and sign back in, then show the preserved level/quest history. | Session flow plus cross-login persistence. |

Do not spend recording time scrolling through source code. The judges need evidence of the product loop.

## Recording quality

Recommended capture settings:

- 1080p or 900p.
- 30 FPS.
- Browser zoom near 100%.
- No desktop notifications or private tabs visible.
- Use a clean test email/password that you are comfortable displaying, or obscure password entry while keeping the flow understandable.
- Keep audio optional; captions or a concise voiceover are enough.

## Keep the file under 100 MB

For a two-minute 1080p recording, H.264 at a moderate bitrate is usually sufficient. If the source file is too large, an optional FFmpeg pass is:

```bash
ffmpeg -i walkthrough-source.mp4 -c:v libx264 -preset medium -crf 24 -maxrate 5M -bufsize 10M -c:a aac -b:a 128k -movflags +faststart walkthrough.mp4
```

Check the final file size and duration before uploading. The repository's submission checker requires you to record those measured values in `submission.json`; it does not pretend that a public share page reveals the underlying media size.

## Hosting

The final link must be reachable from a signed-out/private browser without requesting access. A public unlisted video host or a publicly shared file link is acceptable as long as judges do not need authentication.

After upload, open the URL in an incognito window and play it from beginning to end before submitting.
