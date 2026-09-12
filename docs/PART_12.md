# Part 12 — Deployment and submission package

Part 12 is the release-engineering layer around the completed Life RPG product.

## Implemented

- Render Blueprint for a single-origin Node/Express + built React deployment.
- Neon pooled runtime URL plus direct migration URL contract.
- Render-aware production origin/proxy defaults without hardcoding the generated hostname.
- Build-time absolute canonical/Open Graph metadata for public pages.
- GitHub Actions verification on `main` pushes and pull requests.
- Live production smoke test covering health, database readiness, routing, SEO metadata, security headers and built assets.
- Submission checker covering public repository access, live deployment health, commit history, clean Git state and walkthrough metadata.
- Final README with local setup, environment variables, architecture, verification and deployment instructions.
- Deployment, walkthrough and submission runbooks.

## Deliberately not automated

Creating a Render account/service, changing a GitHub repository's visibility, and uploading a screen recording require the owner's external accounts and explicit actions. The repository is prepared so those actions are short and verifiable instead of being hidden manual configuration.

## Release gates

```text
npm run verify
      ↓
GitHub Actions verify
      ↓
Render build + committed migrations
      ↓
/health/ready
      ↓
npm run verify:live -- --url <HTTPS origin>
      ↓
90–180 s public walkthrough
      ↓
npm run submission:check -- --config submission.json
```

The final UI/UX redesign can now proceed without changing this deployment contract, provided route names, health endpoints and environment behavior remain stable.
