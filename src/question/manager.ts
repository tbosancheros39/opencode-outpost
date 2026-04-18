import { Question, QuestionState, QuestionAnswer } from "./types.js";
import { logger } from "../utils/logger.js";

class QuestionManager {
  private states: Map<number, QuestionState> = new Map();

  private getState(chatId: number): QuestionState {
    let state = this.states.get(chatId);
    if (!state) {
      state = {
        questions: [],
        currentIndex: 0,
        selectedOptions: new Map(),
        customAnswers: new Map(),
        customInputQuestionIndex: null,
        activeMessageId: null,
        messageIds: [],
        isActive: false,
        requestID: null,
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  startQuestions(chatId: number, questions: Question[], requestID: string): void {
    const state = this.getState(chatId);
    logger.debug(
      `[QuestionManager] startQuestions called: isActive=${state.isActive}, currentQuestions=${state.questions.length}, newQuestions=${questions.length}, requestID=${requestID}`,
    );

    if (state.isActive) {
      logger.info(`[QuestionManager] Poll already active! Forcing reset before starting new poll.`);
      this.clear(chatId);
    }

    logger.info(
      `[QuestionManager] Starting new poll with ${questions.length} questions, requestID=${requestID}`,
    );
    state.questions = questions;
    state.currentIndex = 0;
    state.selectedOptions = new Map();
    state.customAnswers = new Map();
    state.customInputQuestionIndex = null;
    state.activeMessageId = null;
    state.messageIds = [];
    state.isActive = true;
    state.requestID = requestID;
  }

  getRequestID(chatId: number): string | null {
    return this.getState(chatId).requestID;
  }

  getCurrentQuestion(chatId: number): Question | null {
    const state = this.getState(chatId);
    if (state.currentIndex >= state.questions.length) {
      return null;
    }
    return state.questions[state.currentIndex];
  }

  selectOption(chatId: number, questionIndex: number, optionIndex: number): void {
    const state = this.getState(chatId);
    if (!state.isActive) {
      return;
    }

    const question = state.questions[questionIndex];
    if (!question) {
      return;
    }

    const selected = state.selectedOptions.get(questionIndex) || new Set();

    if (question.multiple) {
      if (selected.has(optionIndex)) {
        selected.delete(optionIndex);
      } else {
        selected.add(optionIndex);
      }
    } else {
      selected.clear();
      selected.add(optionIndex);
    }

    state.selectedOptions.set(questionIndex, selected);

    logger.debug(
      `[QuestionManager] Selected options for question ${questionIndex}: ${Array.from(selected).join(", ")}`,
    );
  }

  getSelectedOptions(chatId: number, questionIndex: number): Set<number> {
    return this.getState(chatId).selectedOptions.get(questionIndex) || new Set();
  }

  getSelectedAnswer(chatId: number, questionIndex: number): string {
    const state = this.getState(chatId);
    const question = state.questions[questionIndex];
    if (!question) {
      return "";
    }

    const selected = state.selectedOptions.get(questionIndex) || new Set();
    const options = Array.from(selected)
      .map((idx) => question.options[idx])
      .filter((opt) => opt)
      .map((opt) => `* ${opt.label}: ${opt.description}`);

    return options.join("\n");
  }

  setCustomAnswer(chatId: number, questionIndex: number, answer: string): void {
    logger.debug(
      `[QuestionManager] Custom answer received for question ${questionIndex}: ${answer}`,
    );
    this.getState(chatId).customAnswers.set(questionIndex, answer);
  }

  getCustomAnswer(chatId: number, questionIndex: number): string | undefined {
    return this.getState(chatId).customAnswers.get(questionIndex);
  }

  hasCustomAnswer(chatId: number, questionIndex: number): boolean {
    return this.getState(chatId).customAnswers.has(questionIndex);
  }

  nextQuestion(chatId: number): void {
    const state = this.getState(chatId);
    state.currentIndex++;
    state.customInputQuestionIndex = null;
    state.activeMessageId = null;

    logger.debug(
      `[QuestionManager] Moving to next question: ${state.currentIndex}/${state.questions.length}`,
    );
  }

  hasNextQuestion(chatId: number): boolean {
    return this.getState(chatId).currentIndex < this.getState(chatId).questions.length;
  }

  getCurrentIndex(chatId: number): number {
    return this.getState(chatId).currentIndex;
  }

  getTotalQuestions(chatId: number): number {
    return this.getState(chatId).questions.length;
  }

  addMessageId(chatId: number, messageId: number): void {
    this.getState(chatId).messageIds.push(messageId);
  }

  setActiveMessageId(chatId: number, messageId: number): void {
    this.getState(chatId).activeMessageId = messageId;
  }

  getActiveMessageId(chatId: number): number | null {
    return this.getState(chatId).activeMessageId;
  }

  isActiveMessage(chatId: number, messageId: number | null): boolean {
    const state = this.getState(chatId);
    return (
      state.isActive &&
      state.activeMessageId !== null &&
      messageId === state.activeMessageId
    );
  }

  startCustomInput(chatId: number, questionIndex: number): void {
    const state = this.getState(chatId);
    if (!state.isActive || !state.questions[questionIndex]) {
      return;
    }

    state.customInputQuestionIndex = questionIndex;
  }

  clearCustomInput(chatId: number): void {
    this.getState(chatId).customInputQuestionIndex = null;
  }

  isWaitingForCustomInput(chatId: number, questionIndex: number): boolean {
    return this.getState(chatId).customInputQuestionIndex === questionIndex;
  }

  getMessageIds(chatId: number): number[] {
    return [...this.getState(chatId).messageIds];
  }

  isActive(chatId: number): boolean {
    const state = this.getState(chatId);
    logger.debug(
      `[QuestionManager] isActive check: ${state.isActive}, questions=${state.questions.length}, currentIndex=${state.currentIndex}`,
    );
    return state.isActive;
  }

  cancel(chatId: number): void {
    logger.info("[QuestionManager] Poll cancelled");
    const state = this.getState(chatId);
    state.isActive = false;
    state.customInputQuestionIndex = null;
    state.activeMessageId = null;
  }

  clear(chatId: number): void {
    const state = this.getState(chatId);
    state.questions = [];
    state.currentIndex = 0;
    state.selectedOptions = new Map();
    state.customAnswers = new Map();
    state.customInputQuestionIndex = null;
    state.activeMessageId = null;
    state.messageIds = [];
    state.isActive = false;
    state.requestID = null;
  }

  getAllAnswers(chatId: number): QuestionAnswer[] {
    const state = this.getState(chatId);
    const answers: QuestionAnswer[] = [];

    for (let i = 0; i < state.questions.length; i++) {
      const question = state.questions[i];
      const selectedAnswer = this.getSelectedAnswer(chatId, i);
      const customAnswer = this.getCustomAnswer(chatId, i);

      const finalAnswer = customAnswer || selectedAnswer;

      if (finalAnswer) {
        answers.push({
          question: question.question,
          answer: finalAnswer,
        });
      }
    }

    return answers;
  }
}

export const questionManager = new QuestionManager();
