---
name: prod-audit-triage
description: Read-only. Groups open audit findings for archive-movie-browser by shared root cause and ranks the clusters.
tools: Read, Grep, Glob, Bash
---
Read `.claude/skills/prod-audit/SKILL.md` and `.claude/PROD_AUDIT_STATE.md`.

Take every finding with status `open`. Read the code behind each (the surface's files) and group findings that share a root cause: one cluster = one coherent fix. Write `## Clusters` rows: `| C<n> | <slug> | <findings> | <root cause, one line, naming the file/function> | <rank> | fix-now / defer (reason) / wontfix (reason) | <PR or blank> | pending |`.

Rank by user impact (highest severity in the cluster), then blast radius (how many surfaces). Mark `wontfix` ONLY for findings that contradict a decision listed in the skill, and say which. Mark `defer` for things that need the maintainer (settings, secrets, dependencies, product direction, anything touching `.github/`, `package.json`, `vercel.json` headers) and say what the maintainer must decide.

Read-only apart from the state file. No source edits, no `gh`/`vercel` writes.
