# Signal — Job Search Tracker

Daily-refreshing dashboard: fetches fresh PM/Senior PM/Group PM listings, scores
them against your target profile (companies, positioning, comp floor), and
surfaces the top 5 each day. Built off the same JSearch + GitHub Actions
pattern as the IJS student example, stripped down — no auto-resume generation.

## Setup (10 minutes)

1. **Create a new repo** on GitHub, push these files to `main`.

2. **Get a JSearch API key**
   - Go to [rapidapi.com](https://rapidapi.com), search "JSearch", subscribe to the free/BASIC plan.
   - Copy your API key.

3. **Add the secret**
   - Repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `RAPIDAPI_KEY`, value: your key.

4. **Enable GitHub Pages**
   - Repo → Settings → Pages → Source: Deploy from branch → Branch: `main`, folder `/ (root)`.

5. **Run it once manually**
   - Repo → Actions → "Daily job fetch" → Run workflow.
   - This populates `jobs.json`. After that it runs automatically every morning (~7am CT).

6. **Visit your dashboard** at `https://<your-username>.github.io/<repo-name>`

## Tuning your matches

Everything scoring-related lives in `config.js` — no other file needs to
change:
- `targetCompanies` — your named-target list, weighted highest
- `positioningKeywords` — B2B/marketplace/platform signal words
- `aiKeywords` — AI/LLM signal words
- `compFloor` — your $200K TC floor (only applied when a listing discloses salary)
- `weights` — how much each factor counts toward the 0–100ish score

Re-run the workflow manually any time after editing `config.js` to see the
new scoring take effect.

## What this deliberately leaves out

The original tool this was adapted from also auto-generates a tailored resume
per job via Claude Haiku. That's intentionally cut here — your resume and
positioning are being hand-tuned through IJS coaching, and an unsupervised
LLM rewrite per JD would work against that. Use this tool for discovery and
triage; keep resume tailoring manual and coach-informed.
