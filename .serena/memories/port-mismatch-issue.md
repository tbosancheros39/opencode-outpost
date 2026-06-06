# Port Mismatch Issue

## Problem (RESOLVED)
There were **three different ports** in the configuration, all inconsistent:

| Source | Port | File |
|---|---|---|
| systemd service | 4096 | `opencode-server.service` |
| code default / .env.example | 4097 | `src/config.ts` line 123 / `.env.example` |
| production `.env` | 4098 | `.env` line 25 |

Also: `opencode-outpost.service` wrongly referenced `opencode-serve.service` (port 4097, wrong name) and had `EnvironmentFile` commented out.

## Fix (Applied 2026-05-13)
Either:
1. Change `opencode-server.service` ExecStart to `--port 4098`
2. Or change `.env` `OPENCODE_API_URL` to `http://localhost:4096`

The user's integrated chatbot/website runs on port 4098. If that process also exposes the OpenCode API, the bot should work. Otherwise, the port needs alignment.
