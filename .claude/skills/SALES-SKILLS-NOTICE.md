# Sales Skills — Attribution

The `sales` and `sales-*` skills in this directory (plus the `sales-*` agents in
`.claude/agents/`) are vendored from:

  https://github.com/zubair-trabzada/ai-sales-team-claude (MIT License)

An "AI Sales Team" for Claude Code: research prospects, qualify leads (BANT +
MEDDIC), map decision makers, generate outreach and proposals, prepare for
meetings, and produce pipeline reports.

See SALES-SKILLS-LICENSE for the full MIT license and copyright.

## Layout

- `sales/SKILL.md` — orchestrator (routes `/sales <command>`), with
  `sales/scripts/` (Python helpers) and `sales/templates/` (outreach, proposal,
  meeting-prep, objection templates).
- `sales-<name>/SKILL.md` — 13 sub-skills (prospect, research, qualify, contacts,
  outreach, followup, prep, proposal, objections, icp, competitors, report,
  report-pdf).
- `.claude/agents/sales-*.md` — 5 agents used by `/sales prospect` for parallel
  company, contacts, opportunity, competitive, and strategy analysis.

Optional Python deps for PDF reports / richer parsing live in
`sales/requirements.txt`.
