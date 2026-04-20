import { CommandContext, Context, InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession } from "../../session/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

const SKILLS_CALLBACK_PREFIX = "skills:";
const SKILLS_PAGE_PREFIX = `${SKILLS_CALLBACK_PREFIX}page:`;
const SKILLS_TOGGLE_PREFIX = `${SKILLS_CALLBACK_PREFIX}toggle:`;
const SKILLS_CANCEL = `${SKILLS_CALLBACK_PREFIX}cancel`;

const SKILLS_PER_PAGE = 10;

interface SkillItem {
  name: string;
  description?: string;
}

interface SkillsPage {
  skills: SkillItem[];
  hasNext: boolean;
  hasPrev: boolean;
  page: number;
  totalSkills: number;
}

interface SkillsMetadata {
  flow: "skills";
  stage: "list";
  messageId: number;
  directory: string;
  skills: SkillItem[];
  page: number;
  totalSkills: number;
}

function parseSkillsPageCallback(data: string): number | null {
  if (!data.startsWith(SKILLS_PAGE_PREFIX)) {
    return null;
  }
  const rawPage = data.slice(SKILLS_PAGE_PREFIX.length);
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 0) {
    return null;
  }
  return page;
}

function parseToggleCallback(data: string): string | null {
  if (!data.startsWith(SKILLS_TOGGLE_PREFIX)) {
    return null;
  }
  return data.slice(SKILLS_TOGGLE_PREFIX.length);
}

async function loadSkillsPage(
  directory: string,
  page: number,
): Promise<SkillsPage> {
  const { data: allCommands, error } = await opencodeClient.command.list({
    directory,
  });

  if (error || !allCommands) {
    throw error || new Error("Failed to fetch skills");
  }

  // TODO: The `source` field is not in the SDK Command type but is returned by the server.
  // Verify that OpenCode server returns source="skill" for skill-based commands.
  // If not, this filter will return an empty list. See existing commands.ts:309 for same pattern.
  const skills = allCommands
    .filter((cmd: Record<string, unknown>) => cmd.source === "skill")
    .map((cmd: Record<string, unknown>) => ({
      name: cmd.name as string,
      description: cmd.description as string | undefined,
    }));

  const totalSkills = skills.length;
  const startIndex = page * SKILLS_PER_PAGE;
  const endExclusive = Math.min(startIndex + SKILLS_PER_PAGE, totalSkills);
  const pagedSkills = skills.slice(startIndex, endExclusive);
  const hasPrev = page > 0;
  const hasNext = endExclusive < totalSkills;

  return {
    skills: pagedSkills,
    hasNext,
    hasPrev,
    page,
    totalSkills,
  };
}

function formatSkillItem(index: number, skill: SkillItem): string {
  const description = skill.description?.trim() || t("skills.no_description");
  return `${index + 1}. /${skill.name}\n   └ ${description}`;
}

function formatSkillsHeader(page: number, totalSkills: number): string {
  const from = page * SKILLS_PER_PAGE + 1;
  const to = Math.min((page + 1) * SKILLS_PER_PAGE, totalSkills);
  return t("skills.header", { from, to, total: totalSkills });
}

function buildSkillsKeyboard(pageData: SkillsPage): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < pageData.skills.length; i++) {
    const skill = pageData.skills[i];
    const label = `/${skill.name}`;
    keyboard.text(label, `${SKILLS_TOGGLE_PREFIX}${skill.name}`).row();
  }

  if (pageData.hasPrev || pageData.hasNext) {
    if (pageData.hasPrev) {
      keyboard.text(t("skills.button.prev"), `${SKILLS_PAGE_PREFIX}${pageData.page - 1}`);
    }
    if (pageData.hasNext) {
      keyboard.text(t("skills.button.next"), `${SKILLS_PAGE_PREFIX}${pageData.page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text(t("skills.button.cancel"), SKILLS_CANCEL);

  return keyboard;
}

export async function skillsCommand(ctx: CommandContext<Context>) {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply(t("skills.error_no_session"));
      return;
    }

    const project = getCurrentProject(chatId);
    if (!project) {
      await ctx.reply(t("skills.no_project"));
      return;
    }

    logger.debug(`[Skills] Loading skills for project: ${project.worktree}`);

    const pageData = await loadSkillsPage(project.worktree, 0);

    if (pageData.skills.length === 0) {
      await ctx.reply(t("skills.empty"));
      return;
    }

    const header = formatSkillsHeader(0, pageData.totalSkills);
    const skillLines = pageData.skills.map((skill, i) =>
      formatSkillItem(i, skill),
    );
    const hint = t("skills.hint");
    const text = [header, "", ...skillLines, "", hint].join("\n");

    const keyboard = buildSkillsKeyboard(pageData);

    const message = await ctx.reply(text, { reply_markup: keyboard });

    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "skills",
        stage: "list",
        messageId: message.message_id,
        directory: project.worktree,
        skills: pageData.skills,
        page: 0,
        totalSkills: pageData.totalSkills,
      },
    });

    logger.info(`[Skills] Skills list shown for project: ${project.worktree}`);
  } catch (error) {
    logger.error("[Skills] Error loading skills:", error);
    await ctx.reply(t("skills.error_load"));
  }
}

export async function handleSkillsCallback(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery?.data || !callbackQuery.data.startsWith(SKILLS_CALLBACK_PREFIX)) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;
  const state = interactionManager.getSnapshot(chatId);

  if (!state || state.kind !== "custom" || state.metadata.flow !== "skills") {
    await ctx.answerCallbackQuery({ text: t("skills.inactive_callback") });
    return true;
  }

  const metadata = state.metadata as unknown as SkillsMetadata;
  const callbackMessageId = (ctx.callbackQuery?.message as { message_id?: number })?.message_id;

  if (callbackMessageId !== metadata.messageId) {
    await ctx.answerCallbackQuery({ text: t("skills.inactive_callback") });
    return true;
  }

  const data = callbackQuery.data;

  try {
    if (data === SKILLS_CANCEL) {
      interactionManager.clear(chatId, "skills_cancelled");
      await ctx.answerCallbackQuery({ text: t("skills.cancelled_callback") });
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    const page = parseSkillsPageCallback(data);
    if (page !== null) {
      const pageData = await loadSkillsPage(metadata.directory, page);

      const header = formatSkillsHeader(page, pageData.totalSkills);
      const skillLines = pageData.skills.map((skill, i) =>
        formatSkillItem(i, skill),
      );
      const hint = t("skills.hint");
      const text = [header, "", ...skillLines, "", hint].join("\n");

      const keyboard = buildSkillsKeyboard(pageData);

      await ctx.editMessageText(text, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          skills: pageData.skills,
          page,
        },
      });
      return true;
    }

    const skillName = parseToggleCallback(data);
    if (skillName !== null) {
      const skill = metadata.skills.find((s) => s.name === skillName);
      if (!skill) {
        await ctx.answerCallbackQuery({ text: t("skills.not_found") });
        return true;
      }

      await ctx.answerCallbackQuery({ text: t("skills.activating", { name: skillName }) });

      const session = getCurrentSession(chatId);
      if (session) {
        await ctx.reply(t("skills.activation_notice", { name: skillName }));
        logger.info(`[Skills] Skill activation requested: ${skillName}`);
      } else {
        await ctx.reply(t("skills.no_session_warning"));
      }

      interactionManager.clear(chatId, "skills_activated");
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
    return true;
  } catch (error) {
    logger.error("[Skills] Callback error:", error);
    interactionManager.clear(chatId, "skills_callback_error");
    await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
    return true;
  }
}
