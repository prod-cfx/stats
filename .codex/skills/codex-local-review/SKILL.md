---
name: codex-local-review
description: Localized Codex PR review workflow; use when you are inside a Codex session and need to apply the repo's PR-review guardrails, checklist, and structured comment output.
---

# Codex Local Review

## Intent
Keep the same guardrails (GH_TOKEN, review focus, checklist, structured comment template) that the repository expects for Codex PR reviews while you operate inside a Codex session and drive the review manually.

## Preparation (per workflow guards)
1. **Environment**
   - Start from the repository root and ensure `gh` is authenticated so it can fetch diffs, view metadata, and post comments.
   - You already run Codex before activating this skill; no additional `codex` launch is needed from within the skill-logic itself.
   - Keep `CODEX_AUTH_JSON_B64` exported if Codex CLI needs it for other tasks in your session, but this skill only documents the review rules and call flow.
2. **Dependencies**
   - Do not install dependencies during review (no `pnpm install`).
   - Do not run build/test/lint during review; CI is responsible for verification.
   - If you later need to validate changes locally (outside the review step), use the repo-standard command entrypoint `./scripts/dx`.

## Execution (manual skill usage)
1. Use the authenticated `gh` CLI within the session to gather PR data (checkout, diff, view metadata, fetch review history).
2. Apply the checklist from `references/review-standards.md` directly in your prompt or thinking process. Enforce the same constraints: no install/build/test/lint execution, no logs in comments, and maintain the structured template.
3. Reference `.claude/agents/review.md` when formatting your findings: categorize each issue as `P0` through `P3`, include file/line references, clear problem descriptions, and concrete remediation steps. Do not post comments automatically; return the structured `ReviewResult`-style summary to the caller instead.

## Post-review
- Codex should never paste build logs or command output into the PR comment; focus on code analysis, architecture guidance, and security checks outlined in `references/review-standards.md`.
- Confirm that the manually posted comment follows the workflow’s output structure: risk summary, blocking issues, suggestions, checklist, and conclusion.

- `references/review-standards.md`: contains the core constraints, context, checklist, and output format that govern Codex reviews in this repo.
- `.claude/agents/review.md`: use this as the implementation reference for multi-agent review structure (four-dimension analysis, phases, ReviewResult schema).
