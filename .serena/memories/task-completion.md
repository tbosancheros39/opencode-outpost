# Task Completion Checklist

When a coding task is completed, perform these steps in order:

1. **Run linter**: `npm run lint` — must pass with zero warnings
2. **Run formatter**: `npm run format` — ensure code is formatted
3. **Run tests**: `npm test` — all tests must pass
4. **Run test coverage** (if applicable): `npm run test:coverage`
5. **Build**: `npm run build` — ensure TypeScript compiles without errors
6. **Commit**: Only when explicitly asked by the user

## Git Commit Rules
- Never update git config
- Never run destructive/irreversible commands without explicit user request
- Never skip hooks (--no-verify, --no-gpg-sign)
- Never force push to main/master
- Only commit when explicitly asked
- Check AGENTS.md for full commit protocol
