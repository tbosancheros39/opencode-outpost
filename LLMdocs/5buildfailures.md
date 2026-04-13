# 5 Pre-Existing Test Failures — Analysis & Resolution

_Created: 08.04.2026_  
_File: `tests/users/access.test.ts`_

---

## The Single Root Cause

All 5 failures trace back to **one architectural change that was never reflected in the test suite**:

> Fatima (user ID `7917752417`) was promoted from **restricted user** → **super user**.  
> Her entry in `USER_PROJECT_RESTRICTIONS` was deleted. She was added to `SUPER_USER_IDS` in `constants.ts`.  
> **The tests were never updated.**

`USER_PROJECT_RESTRICTIONS` in `src/users/access.ts` is now an empty `Map`:

```typescript
// access.ts — current state
const USER_PROJECT_RESTRICTIONS = new Map<number, UserProjectRestriction>([]);
//                                                                          ^^^ empty
```

Every function under test reads from this map. Empty map → every lookup returns `undefined` → 5 tests that expected Fatima-specific data all fail.

The comment in `access.ts` even documents the decision:
```
NOTE: User 7917752417 (Fatima) was previously listed here but has been
moved to SUPER_USER_IDS for full access. Do NOT re-add super users here.
```

---

## Failure 1 — `getUserProjectRestriction > returns restriction for Fatima`

```
AssertionError: expected undefined to be defined
→ tests/users/access.test.ts:16
```

### Why it fails

```typescript
const restriction = getUserProjectRestriction(FATIMA_ID);
// → USER_PROJECT_RESTRICTIONS.get(7917752417)
// → undefined  (map is empty)

expect(restriction).toBeDefined();  // ❌ undefined is not defined
```

The function does a direct `.get()` on the empty map. No entry for Fatima → `undefined`.

---

## Failure 2 — `getUserSystemPrompt > returns a Bosnian system prompt for Fatima`

```
AssertionError: expected undefined to be defined
→ tests/users/access.test.ts:30
```

### Why it fails

```typescript
// access.ts
export function getUserSystemPrompt(userId: number): string | undefined {
  return USER_PROJECT_RESTRICTIONS.get(userId)?.systemPrompt;
}
```

Same empty map lookup. `undefined?.systemPrompt` → `undefined`. The test also checks:
```typescript
expect(prompt).toMatch(/bosanskom/i);  // would also fail if we got past toBeDefined
```
The Bosnian-language system prompt that used to exist in Fatima's restriction entry is gone.

---

## Failure 3 — `getUserModelVariant > returns 'high' variant for Fatima`

```
AssertionError: expected undefined to be 'high'
→ tests/users/access.test.ts:44
```

### Why it fails

```typescript
// access.ts
export function getUserModelVariant(userId: number): string | undefined {
  return USER_PROJECT_RESTRICTIONS.get(userId)?.modelVariant;
}
```

No entry → `undefined`. Fatima's `modelVariant: "high"` configuration was deleted along with her restriction entry.

---

## Failure 4 — `filterProjectsForUser > filters to only Fatima's project for Fatima`

```
AssertionError: expected [ …(2) ] to have a length of 1 but got 2
→ tests/users/access.test.ts:62
```

### Why it fails — two compounding problems

**Problem A (timing):** The test constructs `fatimaPath` at describe-body level (module collect time):

```typescript
describe("filterProjectsForUser", () => {
  const fatimaPath = getUserProjectRestriction(FATIMA_ID)?.projectPath ?? "";
  //                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //   This runs at collect time — before any beforeAll/beforeEach.
  //   Returns undefined → fatimaPath = ""

  const projects = [
    { id: "p1", worktree: fatimaPath, name: "Fatima" },  // worktree: ""
    { id: "p2", worktree: "/home/user/other-project", name: "Other" },
  ];
```

`fatimaPath` resolves to `""` because `getUserProjectRestriction` returns `undefined` at that moment.

**Problem B (no restriction = no filter):** Even if `fatimaPath` were correct, `filterProjectsForUser` has this logic:

```typescript
export function filterProjectsForUser(userId: number, projects: ProjectInfo[]): ProjectInfo[] {
  const restriction = getUserProjectRestriction(userId);
  if (!restriction) {
    return projects;  // ← returns ALL projects unchanged
  }
  // ... filtering logic never reached
}
```

No restriction for Fatima → function returns all 2 projects unfiltered → `toHaveLength(1)` fails with actual length 2.

---

## Failure 5 — `createFallbackProjectInfo > creates fallback project for Fatima`

```
AssertionError: expected undefined to be defined
→ tests/users/access.test.ts:76
```

### Why it fails

```typescript
// access.ts
export function createFallbackProjectInfo(userId: number): ProjectInfo | undefined {
  const restriction = getUserProjectRestriction(userId);
  if (!restriction) return undefined;  // ← early return triggered
  // ...
}
```

`getUserProjectRestriction(FATIMA_ID)` → `undefined` → early return → `createFallbackProjectInfo` returns `undefined`. Test expects a `ProjectInfo` object with `name: "Fatima"`.

---

## Summary Table

| # | Test | Expected | Actual | Direct cause |
|---|------|----------|--------|-------------|
| 1 | `getUserProjectRestriction` for Fatima | `UserProjectRestriction` object | `undefined` | Empty map |
| 2 | `getUserSystemPrompt` for Fatima | Bosnian string | `undefined` | Empty map → no `systemPrompt` |
| 3 | `getUserModelVariant` for Fatima | `"high"` | `undefined` | Empty map → no `modelVariant` |
| 4 | `filterProjectsForUser` for Fatima | 1 project | 2 projects | No restriction → no filter applied |
| 5 | `createFallbackProjectInfo` for Fatima | `ProjectInfo` object | `undefined` | No restriction → early return |

---

## Resolution Plan

### Why NOT just update tests to expect `undefined`

We could change all the "returns restriction for Fatima" tests to `expect(undefined)`. But that would **destroy all test coverage** of the restriction system — `filterProjectsForUser`, `createFallbackProjectInfo`, `getUserSystemPrompt`, and `getUserModelVariant` would have zero tests verifying their non-trivial code paths.

### Correct Fix — Export the map + inject a test fixture

The fix has two parts:

---

#### Part 1 — `src/users/access.ts` (1-word change)

Add `export` to `USER_PROJECT_RESTRICTIONS`:

```typescript
// before
const USER_PROJECT_RESTRICTIONS = new Map<number, UserProjectRestriction>([]);

// after
export const USER_PROJECT_RESTRICTIONS = new Map<number, UserProjectRestriction>([]);
```

The map stays empty at runtime. Exporting it lets tests inject and clean up a fixture entry without modifying production data. `isSimpleUser`, `SUPER_USER_IDS`, and all runtime behavior are **unchanged**.

---

#### Part 2 — `tests/users/access.test.ts` (updated test file)

```typescript
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  getUserProjectRestriction,
  getUserSystemPrompt,
  getUserModelVariant,
  filterProjectsForUser,
  createFallbackProjectInfo,
  USER_PROJECT_RESTRICTIONS,
} from "../../src/users/access.js";

const FATIMA_ID = 7917752417;
const OTHER_ID = 1402234843;

// Test fixture — mirrors what Fatima's entry would look like as a restricted user.
// This is injected only for tests; production map stays empty (she's a super user).
const FATIMA_FIXTURE = {
  projectPath: "/home/fatima/Fatima",
  projectName: "Fatima",
  systemPrompt: "Odgovaraj uvijek na bosanskom jeziku. Ti si asistent za Fatimu.",
  modelVariant: "high",
} as const;

beforeAll(() => {
  USER_PROJECT_RESTRICTIONS.set(FATIMA_ID, FATIMA_FIXTURE);
});

afterAll(() => {
  USER_PROJECT_RESTRICTIONS.delete(FATIMA_ID);
});

describe("getUserProjectRestriction", () => {
  it("returns restriction for Fatima", () => {
    const restriction = getUserProjectRestriction(FATIMA_ID);
    expect(restriction).toBeDefined();
    expect(restriction?.projectName).toBe("Fatima");
    expect(restriction?.projectPath).toContain("Fatima");
  });

  it("returns undefined for unrestricted users", () => {
    expect(getUserProjectRestriction(OTHER_ID)).toBeUndefined();
    expect(getUserProjectRestriction(999999999)).toBeUndefined();
  });
});

describe("getUserSystemPrompt", () => {
  it("returns a Bosnian system prompt for Fatima", () => {
    const prompt = getUserSystemPrompt(FATIMA_ID);
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe("string");
    expect(prompt!.length).toBeGreaterThan(20);
    expect(prompt).toMatch(/bosanskom/i);
  });

  it("returns undefined for unrestricted users", () => {
    expect(getUserSystemPrompt(OTHER_ID)).toBeUndefined();
  });
});

describe("getUserModelVariant", () => {
  it("returns 'high' variant for Fatima", () => {
    expect(getUserModelVariant(FATIMA_ID)).toBe("high");
  });

  it("returns undefined for unrestricted users", () => {
    expect(getUserModelVariant(OTHER_ID)).toBeUndefined();
  });
});

describe("filterProjectsForUser", () => {
  // Reference FATIMA_FIXTURE directly — avoids the timing bug where
  // getUserProjectRestriction was called at collect time before beforeAll ran.
  const projects = [
    { id: "p1", worktree: FATIMA_FIXTURE.projectPath, name: "Fatima" },
    { id: "p2", worktree: "/home/user/other-project", name: "Other" },
  ];

  it("filters to only Fatima's project for Fatima", () => {
    const filtered = filterProjectsForUser(FATIMA_ID, projects);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("p1");
  });

  it("excludes Fatima's project for unrestricted users", () => {
    const filtered = filterProjectsForUser(OTHER_ID, projects);
    expect(filtered).toHaveLength(2);
  });
});

describe("createFallbackProjectInfo", () => {
  it("creates fallback project for Fatima", () => {
    const fallback = createFallbackProjectInfo(FATIMA_ID);
    expect(fallback).toBeDefined();
    expect(fallback?.name).toBe("Fatima");
    expect(fallback?.id).toContain(String(FATIMA_ID));
  });

  it("returns undefined for unrestricted users", () => {
    expect(createFallbackProjectInfo(OTHER_ID)).toBeUndefined();
  });
});
```

**Key changes from the current test file:**
| Change | Why |
|--------|-----|
| Added `beforeAll`/`afterAll` imports | Lifecycle hooks needed |
| Added `USER_PROJECT_RESTRICTIONS` import | To inject/remove fixture |
| Added `FATIMA_FIXTURE` constant | Test data definition |
| Replaced describe-level `fatimaPath` call with direct `FATIMA_FIXTURE.projectPath` | Fixes timing bug — describe body runs at collect time, before `beforeAll` |
| Added global `beforeAll`/`afterAll` blocks | Inject fixture before tests, clean up after |

---

## Expected Result After Fix

```
npm test -- tests/users/access.test.ts

✓ getUserProjectRestriction > returns restriction for Fatima
✓ getUserProjectRestriction > returns undefined for unrestricted users
✓ getUserSystemPrompt > returns a Bosnian system prompt for Fatima
✓ getUserSystemPrompt > returns undefined for unrestricted users
✓ getUserModelVariant > returns 'high' variant for Fatima
✓ getUserModelVariant > returns undefined for unrestricted users
✓ filterProjectsForUser > filters to only Fatima's project for Fatima
✓ filterProjectsForUser > excludes Fatima's project for unrestricted users
✓ createFallbackProjectInfo > creates fallback project for Fatima
✓ createFallbackProjectInfo > returns undefined for unrestricted users

Tests  10/10 passed ✅
```

Full suite: `480 → 485 passing, 0 failures`.

---

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `src/users/access.ts` | Add `export` to `USER_PROJECT_RESTRICTIONS` | Zero runtime impact — map stays empty in production |
| `tests/users/access.test.ts` | Add lifecycle hooks + fixture injection + fix timing bug | Tests now correctly cover restriction code paths |
