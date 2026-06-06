# Security Audit — Secrets in Git History

**Date:** 2026-06-06 | **Status:** MUST FIX BEFORE ANY PUSH

## Secrets Found in Committed Files

| File | Secret | Lines | Commit |
|------|--------|-------|--------|
| `docs/superpowers/specs/2026-06-05-v0.16-release-orchestration-design.md` | GitHub PAT (`github_pat_...`) | L9, L326, L1139 | 1bc2848 |
| `.serena/memories/v0.16-release-plan-corrected.md` | GitHub PAT (`github_pat_...`) | L81 | c371f3c |
| `opencode.json` | EXA_API_KEY | L167 | in diff since v0.15.1 |
| `opencode.json` | FIRECRAWL_API_KEY | L175 | in diff since v0.15.1 |
| `opencode.json` | CONTEXT7_API_KEY | L186 | in diff since v0.15.1 |

## Action Items (BEFORE any git push)

1. **Scrub secrets from working tree:**
   - Remove GitHub PAT from design spec (replace with `[REDACTED]`)
   - Remove GitHub PAT from Serena memory (replace with `[REDACTED]`)
   - Remove API keys from opencode.json (replace with `[REDACTED]`)

2. **Rewrite git history:**
   - Use `git filter-repo` or `BFG Repo-Cleaner` to purge secrets from ALL past commits
   - This rewrites SHA hashes — tags v0.15.2, v0.16.0, v0.16.1 will need re-creating
   - Force push will be required after history rewrite

3. **Rotate ALL exposed secrets immediately:**
   - GitHub PAT: revoke at github.com/settings/tokens and create new one
   - EXA_API_KEY: rotate at exa.ai dashboard
   - FIRECRAWL_API_KEY: rotate at firecrawl.dev dashboard
   - CONTEXT7_API_KEY: rotate at context7 dashboard

4. **Add .gitignore rules:**
   - Never commit files containing `_KEY=`, `_TOKEN=`, `_SECRET=`, `_PAT=` with actual values
   - Use `.env` for secrets (already gitignored)

## Release Status

| Version | Commit | Tag | Build | Tests | npm Publish |
|---------|--------|-----|-------|-------|-------------|
| v0.15.2 | 969b7ec | ✅ | ✅ | ✅ 703 | ❌ BLOCKED (npm auth) |
| v0.16.0 | c371f3c | ✅ | ✅ | ✅ 703 | ❌ BLOCKED (npm auth) |
| v0.16.1 | 6af51eb | ✅ | ✅ | ✅ 724 | ❌ BLOCKED (npm auth) |

## npm Auth
- Token provided by user: `[REDACTED]`
- Needs `npm login` or `npm set //registry.npmjs.org/:_authToken=...` before publish

## GitHub PAT
- Token: `[REDACTED]`
- Used for: git push, GitHub Releases
- MUST be rotated after secrets are scrubbed from history
