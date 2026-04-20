import { describe, expect, it } from "vitest";
import {
  getUserProjectRestriction,
  getUserSystemPrompt,
  getUserModelVariant,
  filterProjectsForUser,
  createFallbackProjectInfo,
} from "../../src/users/access.js";

const ANY_USER_ID = 123456789;

describe("getUserProjectRestriction", () => {
  it("returns undefined for any user (stub)", () => {
    expect(getUserProjectRestriction(ANY_USER_ID)).toBeUndefined();
  });
});

describe("getUserSystemPrompt", () => {
  it("returns undefined for any user (stub)", () => {
    expect(getUserSystemPrompt(ANY_USER_ID)).toBeUndefined();
  });
});

describe("getUserModelVariant", () => {
  it("returns undefined for any user (stub)", () => {
    expect(getUserModelVariant(ANY_USER_ID)).toBeUndefined();
  });
});

describe("filterProjectsForUser", () => {
  it("returns all projects unchanged (stub)", () => {
    const projects = [
      { id: "p1", worktree: "/home/user/project1", name: "Project 1" },
      { id: "p2", worktree: "/home/user/project2", name: "Project 2" },
    ];
    const filtered = filterProjectsForUser(ANY_USER_ID, projects);
    expect(filtered).toEqual(projects);
    expect(filtered).toHaveLength(2);
  });
});

describe("createFallbackProjectInfo", () => {
  it("returns undefined for any user (stub)", () => {
    expect(createFallbackProjectInfo(ANY_USER_ID)).toBeUndefined();
  });
});
