import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { helpCommand } from "../../../src/bot/commands/help.js";
import { getLocalizedBotCommands } from "../../../src/bot/commands/definitions.js";

const mockedAccess = vi.hoisted(() => ({
  isSimpleUser: vi.fn(() => false),
}));

vi.mock("../../../src/users/access.js", () => ({
  isSimpleUser: mockedAccess.isSimpleUser,
}));

function createCtx(fromId?: number): { reply: ReturnType<typeof vi.fn>; from?: { id: number } } {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    ...(fromId !== undefined ? { from: { id: fromId } } : {}),
  } as unknown as { reply: ReturnType<typeof vi.fn>; from?: { id: number } };
}

describe("bot/commands/help", () => {
  it("returns full commands list from centralized definitions", async () => {
    const ctx = createCtx();
    await helpCommand(ctx as unknown as Context);

    expect(ctx.reply).toHaveBeenCalledTimes(1);

    const helpText = ctx.reply.mock.calls[0][0] as string;
    const commands = getLocalizedBotCommands();

    for (const item of commands) {
      expect(helpText).toContain(`/${item.command}`);
      expect(helpText).toContain(item.description);
    }
  });

  describe("grouped output", () => {
    const categoryHeaders = [
      "📁 Session",
      "⚙️ Tasks",
      "📂 Local Ops",
      "🔧 Git",
      "🔍 Browse",
      "🤖 Bot Control",
    ] as const;

    it("contains all 6 category headers", async () => {
      const ctx = createCtx();
      await helpCommand(ctx as unknown as Context);

      const helpText = ctx.reply.mock.calls[0][0] as string;

      for (const header of categoryHeaders) {
        expect(helpText).toContain(header);
      }
    });

    it("each category section lists at least 1 command", async () => {
      const ctx = createCtx();
      await helpCommand(ctx as unknown as Context);

      const helpText = ctx.reply.mock.calls[0][0] as string;
      const lines = helpText.split("\n");

      for (const header of categoryHeaders) {
        const headerIndex = lines.findIndex((l) => l.includes(header));
        expect(headerIndex).not.toBe(-1);

        const cmdLine = lines.find((l, i) => i > headerIndex && l.trim() !== "");
        expect(cmdLine).toBeDefined();
        expect(cmdLine!.startsWith("/")).toBe(true);
      }
    });

    it("contains tip about /commands keyboard", async () => {
      const ctx = createCtx();
      await helpCommand(ctx as unknown as Context);

      const helpText = ctx.reply.mock.calls[0][0] as string;
      expect(helpText).toContain("💡 Tip: Use /commands for interactive keyboard");
    });
  });

  describe("simple user help", () => {
    it("returns simple help text for simple users", async () => {
      mockedAccess.isSimpleUser.mockReturnValue(true);

      const ctx = createCtx(42);
      await helpCommand(ctx as unknown as Context);

      const helpText = ctx.reply.mock.calls[0][0] as string;
      expect(helpText).toContain("📖 Pomoć");
      expect(helpText).toContain("/new");
      expect(helpText).toContain("/abort");
      expect(helpText).not.toContain("📁 Session");
      expect(helpText).not.toContain("💡 Tip: Use /commands");
    });

    it("normal user gets grouped help text", async () => {
      mockedAccess.isSimpleUser.mockReturnValue(false);

      const ctx = createCtx(42);
      await helpCommand(ctx as unknown as Context);

      const helpText = ctx.reply.mock.calls[0][0] as string;
      expect(helpText).toContain("📁 Session");
      expect(helpText).toContain("💡 Tip: Use /commands for interactive keyboard");
    });
  });
});
