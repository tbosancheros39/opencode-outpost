import { permissionManager } from "../permission/manager.js";
import { questionManager } from "../question/manager.js";
import { renameManager } from "../rename/manager.js";
import { taskCreationManager } from "../scheduled-task/creation-manager.js";
import { interactionManager } from "./manager.js";
import { logger } from "../utils/logger.js";

export function clearAllInteractionState(chatId: number, reason: string): void {
  const questionActive = questionManager.isActive(chatId);
  const permissionActive = permissionManager.isActive(chatId);
  const renameActive = renameManager.isWaitingForName(chatId);
  const taskCreationActive = taskCreationManager.isActive();
  const interactionSnapshot = interactionManager.getSnapshot(chatId);

  questionManager.clear(chatId);
  permissionManager.clear(chatId);
  renameManager.clear(chatId);
  taskCreationManager.clear();
  interactionManager.clear(chatId, reason);

  const hasAnyActiveState =
    questionActive ||
    permissionActive ||
    renameActive ||
    taskCreationActive ||
    interactionSnapshot !== null;

  const message =
    `[InteractionCleanup] Cleared state: reason=${reason}, ` +
    `questionActive=${questionActive}, permissionActive=${permissionActive}, ` +
    `renameActive=${renameActive}, taskCreationActive=${taskCreationActive}, ` +
    `interactionKind=${interactionSnapshot?.kind || "none"}`;

  if (hasAnyActiveState) {
    logger.info(message);
    return;
  }

  logger.debug(message);
}
