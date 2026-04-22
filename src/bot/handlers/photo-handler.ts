import type { Context } from "grammy";
import type { FilePartInput } from "@opencode-ai/sdk/v2";
import { processUserPrompt, type ProcessPromptDeps } from "./prompt.js";
import {
  downloadTelegramFile,
  toDataUri,
  isFileSizeAllowed,
} from "../utils/file-download.js";
import { getModelCapabilities, supportsInput } from "../../model/capabilities.js";
import { getStoredModel } from "../../model/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { config } from "../../config.js";

/**
 * ProcessPromptDeps interface (from 08-handler-prompt.ts lines 79-82):
 * export interface ProcessPromptDeps {
 *   bot: Bot<Context>;
 *   ensureEventSubscription: (directory: string) => Promise<void>;
 * }
 */
export interface PhotoHandlerDeps extends ProcessPromptDeps {
  downloadFile?: (
    api: Context["api"],
    fileId: string,
  ) => Promise<{ buffer: Buffer; filePath: string }>;
  getModelCapabilities?: (
    providerId: string,
    modelId: string,
  ) => Promise<import("@opencode-ai/sdk/v2").Model["capabilities"] | null>;
  getStoredModel?: () => { providerID: string; modelID: string };
  processPrompt?: (
    ctx: Context,
    text: string,
    deps: ProcessPromptDeps,
    fileParts?: FilePartInput[],
  ) => Promise<boolean>;
}

/**
 * Photo handler for Telegram bot
 * Uses the exact ProcessPromptDeps interface pattern from 08-handler-prompt.ts
 * Checks model capabilities for vision support via supportsInput (16-model-capabilities.ts)
 * Downloads files via downloadTelegramFile (24-file-download.ts) and converts to data URI via toDataUri
 */
export async function handlePhotoMessage(
  ctx: Context,
  deps: PhotoHandlerDeps,
): Promise<void> {
  const downloadFile = deps.downloadFile ?? downloadTelegramFile;
  const getCapabilities = deps.getModelCapabilities ?? getModelCapabilities;
  const getStored = deps.getStoredModel ?? getStoredModel;
  const processPrompt = deps.processPrompt ?? processUserPrompt;

  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    return;
  }

  const caption = ctx.message?.caption || "";

  // Get the largest photo (best quality)
  const largestPhoto = photo[photo.length - 1];

  if (!isFileSizeAllowed(largestPhoto.file_size, config.files.maxFileSizeKb)) {
    logger.warn(
      `[Photo] Photo too large: ${largestPhoto.file_id} (${largestPhoto.file_size} bytes > ${config.files.maxFileSizeKb}KB)`,
    );
    await ctx.reply(
      t("bot.photo_too_large", { maxSizeMb: String(config.files.maxFileSizeKb / 1024) }),
    );
    return;
  }

  try {
    // Check if model supports image input (supportsInput from 16-model-capabilities.ts)
    const storedModel = getStored();
    const capabilities = await getCapabilities(storedModel.providerID, storedModel.modelID);

    if (!supportsInput(capabilities, "image")) {
      logger.warn(
        `[Photo] Model ${storedModel.providerID}/${storedModel.modelID} doesn't support image input`,
      );
      await ctx.reply(t("bot.photo_model_no_image"));

      // Send text only if caption exists
      if (caption.trim().length > 0) {
        await processPrompt(ctx, caption, deps);
      } else {
        await ctx.reply(t("bot.photo_no_caption"));
      }
      return;
    }

    // Download the photo (downloadTelegramFile from 24-file-download.ts)
    await ctx.reply(t("bot.photo_downloading"));
    const downloadedFile = await downloadFile(ctx.api, largestPhoto.file_id);

    // Convert to data URI (toDataUri from 24-file-download.ts)
    const mimeType = "image/jpeg"; // Telegram photos are JPEG
    const dataUri = toDataUri(downloadedFile.buffer, mimeType);

    // Create file part for the prompt
    const filePart: FilePartInput = {
      type: "file",
      mime: mimeType,
      filename: "photo.jpg",
      url: dataUri,
    };

    logger.info(
      `[Photo] Sending photo (${downloadedFile.buffer.length} bytes) with caption: "${caption}"`,
    );

    // Process the prompt with the photo attached
    await processPrompt(ctx, caption || "Describe this image", deps, [filePart]);
  } catch (err) {
    logger.error("[Photo] Error handling photo message:", err);
    await ctx.reply(t("bot.photo_download_error"));
  }
}

/**
 * Factory function to create a photo handler with injected dependencies
 * Pattern from 10-handler-voice.ts (createVoiceHandler)
 */
export function createPhotoHandler(deps: PhotoHandlerDeps) {
  return async (ctx: Context): Promise<void> => {
    await handlePhotoMessage(ctx, deps);
  };
}
