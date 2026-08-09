# Git Merge Strategy

## Goal

Keep mainline history clean while preserving local development history.

## Required Strategy

1. Feature PRs must use Squash and merge.
2. Merge between long-lived branches (`develop` -> `stage` -> `main`) must use regular merge commit.

## Why

1. A feature PR usually represents one complete change, so one commit is easier to trace and revert.
2. WIP commits should not pollute `develop`, `stage`, or `main` history.
3. Long-lived branch integration should preserve merge context and release flow.

## Recommended GitHub Settings

For feature target branches (usually `develop`):

1. Enable `Squash merge`.
2. Disable `Rebase merge` (optional but recommended for consistency).
3. Keep `Merge commit` disabled for normal feature PRs.

For integration PRs (`develop` -> `stage`, `stage` -> `main`):

1. Use `Create a merge commit`.

## Local Workflow: Keep Full Local History, Push Single PR Commit

If your local branch has many commits but you want only one commit in the PR branch, use a publish branch.

Assume:

- local tracking branch: `feat/yourname/work-log` (many local commits)
- base branch: `origin/develop`
- publish branch: `feat/yourname/work-log-pr`

```bash
# 1) Keep your original local branch as-is
git checkout feat/yourname/work-log

# 2) Create a clean publish branch from latest base
git fetch origin
git checkout -b feat/yourname/work-log-pr origin/develop

# 3) Squash merge local work into one staged change
git merge --squash feat/yourname/work-log

# 4) Create one commit for PR
git commit -m "feat(config-dialog): summarize completed change"

# 5) Push publish branch and open PR
git push -u origin feat/yourname/work-log-pr
```

This keeps:

1. Local detailed commits on `feat/yourname/work-log` for tracking.
2. One clean commit in PR branch.
3. One final commit in target branch after Squash and merge.

## Notes

1. Do not force-push to shared long-lived branches.
2. If branch protection is enabled, enforce required checks before merge.
3. Keep PR title and squash commit message meaningful because they become the mainline history entry.
