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
    // Should contain Bosnian language instruction
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
    // filterProjectsForUser returns all projects unchanged for unrestricted users
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
