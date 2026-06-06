# Commands

## Build & Run
- `npm run build` — TypeScript compile (tsc, required before start/dev)
- `npm run dev` — build + start
- `npm start` — node dist/index.js (must build first)
- `npm run dev:bot` — build + start in "sources" mode (reads .env from project root)
- `npx @tbosancheros39/opencode-outpost` — runs in "installed" mode (reads .env from ~/.config/opencode-outpost/)
- `opencode-outpost start --mode sources|installed` — explicit mode override

## Testing
- `npm test` — vitest run
- `npm run test:coverage` — vitest run --coverage
- `npx vitest run tests/path/to/test.ts` — run single test
- `npx vitest run tests/bot/commands/` — run directory

## Linting & Formatting
- `npm run lint` — eslint src --ext .ts --max-warnings=0
- `npm run format` — prettier --write "src/**/*.ts"

## OpenCode Server
- `opencode serve --port 4096` — start OpenCode server (port from systemd service)
- `opencode serve --port 4098` — alternative port used if .env points to 4098

## System Commands
- Standard Linux commands (bash, git, ls, etc.)
- Systemd: `systemctl --user status opencode-outpost`, `systemctl --user status opencode-server`
- Logs: `journalctl --user -u opencode-outpost -f`
