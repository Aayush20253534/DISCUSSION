# Submission package

Part 12 turns the working application into a reproducible release package. The final submission has three externally visible artifacts:

1. **Public GitHub repository** with complete frontend/backend source, migrations, lockfile, environment templates and setup instructions.
2. **Public HTTPS deployment** with the real Neon-backed application.
3. **Public 90–180 second walkthrough video under 100 MB**.

## Final values

Copy `submission.example.json` to `submission.json` and replace every placeholder:

```json
{
  "liveUrl": "https://your-service.onrender.com",
  "repositoryUrl": "https://github.com/your-user/life-rpg",
  "videoUrl": "https://public-video-link",
  "videoSeconds": 120,
  "videoSizeMb": 75
}
```

`videoSeconds` and `videoSizeMb` are the measured final values, not estimates.

## Required release sequence

Run the local release gate first:

```powershell
npm ci --workspaces --include-workspace-root --include=dev
npm run verify
git status
```

Commit and push the final source to `main`. The repository must contain at least three meaningful chronological commits and must be publicly readable.

Deploy from that exact commit. After deployment:

```powershell
npm run verify:live -- --url https://your-service.onrender.com
```

Record and upload the walkthrough according to `docs/WALKTHROUGH.md`.

Finally, when the working tree is clean:

```powershell
npm run submission:check -- --config submission.json
```

The final checker refuses to pass if:

- the current branch is not `main`;
- fewer than three commits exist;
- the working tree has uncommitted files;
- the repository URL is not publicly reachable;
- the live app fails the production smoke test;
- the walkthrough URL is not publicly reachable;
- the declared duration is outside 90–180 seconds;
- the declared file size is 100 MB or larger;
- core release files such as README, env templates, deployment config or submission docs are missing.

## Manual judge-perspective check

Automation cannot replace this final pass. Open an incognito browser with no developer cookies and verify:

- repository URL opens without a GitHub permission error;
- live URL loads from a cold start;
- signup and login work;
- a quest can be created and completed;
- the completion produces XP/Gold and a level-up when expected;
- refresh preserves the result;
- `/quests`, `/character`, `/marketplace` and `/settings` can be refreshed directly;
- mobile layout is usable;
- keyboard Tab/Enter/Space navigation is usable;
- browser console has no uncaught errors;
- walkthrough link plays without requesting access.

## What the automated checker does not claim

It cannot prove that a person actually performed the real-world task, and it cannot inspect the duration of arbitrary hosted video pages. The duration and file size are therefore supplied from the final media file and validated as submission metadata. It also does not make a private repository public; that remains an explicit GitHub repository setting.
