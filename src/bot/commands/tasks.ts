import { CommandContext, Context } from "grammy";
import { getTasksByUser } from "../../task-queue/store.js";
import { logger } from "../../utils/logger.js";
import type { TaskStatus } from "../../task-queue/types.js";

export async function tasksCommand(ctx: CommandContext<Context>) {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("❌ Unable to identify user.");
      return;
    }
    
    const tasks = getTasksByUser(userId, 10);
    
    if (tasks.length === 0) {
      await ctx.reply("📋 No tasks found. Send a prompt to create a task!");
      return;
    }
    
    const lines: string[] = ["📋 <b>Your Recent Tasks</b>", ""];
    
    const statusEmojis: Record<TaskStatus, string> = {
      queued: "⏳",
      running: "🔄",
      completed: "✅",
      error: "❌",
    };
    
    for (const task of tasks) {
      const statusEmoji = statusEmojis[task.status];
      
      const shortPrompt = task.promptText.substring(0, 40).replace(/[<>&]/g, "") + "...";
      const createdTime = new Date(task.createdAt).toLocaleTimeString();
      
      lines.push(`${statusEmoji} <code>${task.id.slice(0, 20)}...</code>`);
      lines.push(`   ${shortPrompt}`);
      lines.push(`   Created: ${createdTime} | Status: ${task.status}`);
      
      if (task.status === "completed" && task.resultText) {
        const preview = task.resultText.substring(0, 80).replace(/[<>&]/g, "");
        lines.push(`   Result: ${preview}...`);
      } else if (task.status === "error" && task.errorMessage) {
        const error = task.errorMessage.substring(0, 80).replace(/[<>&]/g, "");
        lines.push(`   Error: ${error}...`);
      }
      
      lines.push("");
    }
    
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    
  } catch (err) {
    logger.error("[Bot] tasksCommand error:", err);
    await ctx.reply("❌ Failed to retrieve tasks.");
  }
}
