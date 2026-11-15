# WORKFLOW — the rcm-doctor playbook

How we work, so every session can start right away. `/resume` reads this file.

## 1. Parallel Claude Code sessions with git worktrees
- **One branch per week** (`week-6`, `week-7`, …), each in its own worktree next to the repo:
  ```bash
  git fetch && git worktree add ../rcm-doctor-w7 -b week-7 origin/main
  cp .env.local ../rcm-doctor-w7/.env.local   # .env* is gitignored, so copy it by hand
  cd ../rcm-doctor-w7 && npm ci
  ```
- **A different port per worktree**, so dev servers don't collide: main `3000`, week-N `3000+N`
  (e.g. `npm run dev -- -p 3007`). Playwright on a worktree: set `E2E_BASE_URL=http://localhost:<port>`.
- One Claude Code session per worktree. A session works only on its own branch and leaves a handoff in
  `docs/handoff/<branch>.md` (what's done, what's open, how to verify).
- New decisions → a new ADR in `docs/decisions/`. Number it when it lands on main, not on the branch, so
  parallel branches don't collide (as happened with 0015 on week-6).
- Cleanup after merging: `git worktree remove ../rcm-doctor-wN && git branch -d week-N`.
  Keep the handoff in `docs/history/`.

## 2. Nicola's 10-minute check before every merge
Claude prepares it; Nicola does it. Nothing reaches main without it.
1. Read the handoff (2 min): is the scope what we agreed?
2. Open the branch's preview or local port and try the new feature once with the demo (`/?demo`) (4 min).
3. Spot-check one finding: does it cite the exact source text span? (2 min)
4. Check `npm run lint && npm test && npm run eval` is green (Claude has already run it and pasted the output) and
   the eval numbers didn't drop (2 min).
5. OK → the coordinator merges. Not OK → a note in the handoff, and the branch goes back to its session.

## 3. The coordinator
- A single session (on `main`) **merges everything at the end**, one branch at a time, after Nicola's OK.
- For each branch: `git merge main` on the branch → resolve conflicts (usually `docs/`, ADR numbers,
  CHANGELOG) → `npm run lint && npm test && npm run eval` → merge into main → push.
- After the last merge: wait for the Vercel production deploy, then
  `E2E_BASE_URL=https://rcm-doctor.vercel.app npx playwright test`. Update STATUS, CHANGELOG and README.
- Only the coordinator touches `docs/STATUS.md` and `CHANGELOG.md` on main. Branches write to their own handoff.

## 4. Code freeze 2 hours before the post
- From T−2h: **no pushes to main** except fixes for something broken in the demo or the video.
- In the freeze window: verify production (prod e2e), make sure the video and the README "Try it in 30 seconds"
  link work, and finalize the post text.

## 5. Publishing via Taplio
1. **Claude creates the draft** in Taplio (text from `docs/posts/`).
2. **Video attached from jsDelivr:**
   `https://cdn.jsdelivr.net/gh/nicoladelbene/rcm-doctor@main/docs/media/<file>.mp4`
   (not raw.githubusercontent.com, which serves `application/octet-stream` and Taplio won't accept it).
   The file has to be pushed to main first. jsDelivr caches `@main`, so for a re-recorded video use a new
   file name or a commit SHA instead of `@main`.
3. **Scheduling only after Nicola's explicit OK** on the final draft (text + video). Claude never schedules or
   publishes on its own.
4. **First comment (with the link) pasted by hand by Nicola** right after the post goes live. Claude has the text
   ready in `docs/posts/` (section "First comment").
