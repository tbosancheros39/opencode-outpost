# Changelog

## v0.16.1 (2026-06-06)

### Tests
- Added health probe tests (8 tests for Redis/OpenCode health checks)
- Added /status health display tests (3 tests)
- Added wizard health step failure tests (5 tests)
- Added /help grouped output tests (5 tests)

### Bug Fixes
- Fixed health-probes.ts: skipped path was unreachable (ok:true should be ok:false when skipped)

### CI/CD
- Added GitHub Actions CI workflow with npm dependency caching

## v0.16.0 (2026-06-06)

### Features
- Added Redis and OpenCode health check probes
- First-run wizard now shows health check results after .env creation
- Actionable error messages for Redis and OpenCode failures
- `/help` command now shows commands grouped by category
- `/status` command now shows Redis health and queue statistics

### Chores
- Added i18n keys for 7 locales (en, de, es, fr, ru, zh, bs)

## v0.15.2 (2026-06-06)

### Dependency Updates
- Updated dependencies — @opencode-ai/sdk 1.4.12→1.14.19, bullmq 5.74.1→5.75.2, eslint 10.2.0→10.2.1

### Features
- add Docker setup, Windows guide, cross-platform config, fix test isolation
- add knowledge base, pin/find/snapshot/resume/digest commands, fix DB path resolution and initSchema recursion

### Bug Fixes
- update watchdog test mocks to include healthy response
- model selection, SDK response shape, watchdog health endpoint
- /digest, /find, KB chunk overlap; add tests for new commands
- pass port from config to opencode serve in watchdog restart
- prevent interaction guard deadlock when prompt completes
- use SDK auth param instead of Basic auth, change default port to 4097
- publish to correct scoped package @tbosancheros39/opencode-outpost v0.14.3

### Chores
- sanitize .gitignore to remove recon-leak patterns
- release v0.15.1
- remove stale docs and build artifacts
- release v0.15.0
- bump version to 0.14.1
- harden package for npm trust chain — fix repo URLs, add .npmignore, add sideEffects field
- consolidate repository — cleanup grinev files, add demo video, fix SDK auth

### Documentation
- add v0.16 release orchestration design spec
- note proxy required when spawning sub-agents
- remove duplicate video demo
- replace broken gifyu links with local demo files
- update README with gifyu.com GIFs, add SECURITY.md, Windows guide, and remove old assets
- add AGENTS.md — compact instruction file for future OpenCode sessions
- add skills.zip and usage instructions with context warning
- add demo GIF to README

### Other Changes
- Update LICENSE.md: move fork acknowledgment to top, remove modification list
