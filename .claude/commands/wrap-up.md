---
description: End the session — update memory files, draft the post, commit and push
---
1. Rewrite docs/STATUS.md: where we are, next exact step, open questions, known issues, metrics
   (re-run `npm run eval` and paste the numbers). Update the "Last session" date.
2. Update docs/ROADMAP.md if scope moved. Add an ADR in docs/decisions/ for any new decision.
3. If this session shipped a weekly increment: draft docs/posts/<date>-week-<n>.md
   (short, visual-first; list which GIF/screenshot to attach) and refresh docs/media/.
4. Update README if features changed.
5. `git add -A && git commit -m "<meaningful message>" && git push`.
6. Tell Nicola in Italian, in 5 lines max: what shipped, the next step, and the post draft location.
