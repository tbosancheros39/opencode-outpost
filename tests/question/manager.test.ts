import { describe, expect, it } from "vitest";
import { questionManager } from "../../src/question/manager.js";
import type { Question } from "../../src/question/types.js";

const TEST_CHAT_ID = 123456;

const SINGLE_QUESTION: Question = {
  question: "Pick one option",
  header: "single",
  options: [
    { label: "Yes", description: "accept" },
    { label: "No", description: "decline" },
  ],
};

const MULTIPLE_QUESTION: Question = {
  question: "Pick multiple options",
  header: "multiple",
  multiple: true,
  options: [
    { label: "Alpha", description: "first" },
    { label: "Beta", description: "second" },
    { label: "Gamma", description: "third" },
  ],
};

describe("questionManager", () => {
  it("starts poll and moves through questions", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION, MULTIPLE_QUESTION], "req-1");

    expect(questionManager.isActive(TEST_CHAT_ID)).toBe(true);
    expect(questionManager.getRequestID(TEST_CHAT_ID)).toBe("req-1");
    expect(questionManager.getCurrentIndex(TEST_CHAT_ID)).toBe(0);
    expect(questionManager.getCurrentQuestion(TEST_CHAT_ID)?.question).toBe(SINGLE_QUESTION.question);

    questionManager.nextQuestion(TEST_CHAT_ID);
    expect(questionManager.getCurrentIndex(TEST_CHAT_ID)).toBe(1);
    expect(questionManager.getCurrentQuestion(TEST_CHAT_ID)?.question).toBe(MULTIPLE_QUESTION.question);

    questionManager.nextQuestion(TEST_CHAT_ID);
    expect(questionManager.hasNextQuestion(TEST_CHAT_ID)).toBe(false);
    expect(questionManager.getCurrentQuestion(TEST_CHAT_ID)).toBeNull();
  });

  it("resets previous active poll when starting a new one", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION], "req-old");
    questionManager.selectOption(TEST_CHAT_ID, 0, 1);
    questionManager.addMessageId(TEST_CHAT_ID, 42);

    questionManager.startQuestions(TEST_CHAT_ID, [MULTIPLE_QUESTION], "req-new");

    expect(questionManager.getRequestID(TEST_CHAT_ID)).toBe("req-new");
    expect(questionManager.getTotalQuestions(TEST_CHAT_ID)).toBe(1);
    expect(questionManager.getSelectedOptions(TEST_CHAT_ID, 0)).toEqual(new Set<number>());
    expect(questionManager.getMessageIds(TEST_CHAT_ID)).toEqual([]);
  });

  it("handles single-choice and multiple-choice selections", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION, MULTIPLE_QUESTION], "req-2");

    questionManager.selectOption(TEST_CHAT_ID, 0, 0);
    questionManager.selectOption(TEST_CHAT_ID, 0, 1);
    expect(questionManager.getSelectedOptions(TEST_CHAT_ID, 0)).toEqual(new Set([1]));
    expect(questionManager.getSelectedAnswer(TEST_CHAT_ID, 0)).toBe("* No: decline");

    questionManager.selectOption(TEST_CHAT_ID, 1, 0);
    questionManager.selectOption(TEST_CHAT_ID, 1, 1);
    questionManager.selectOption(TEST_CHAT_ID, 1, 0);
    expect(questionManager.getSelectedOptions(TEST_CHAT_ID, 1)).toEqual(new Set([1]));
    expect(questionManager.getSelectedAnswer(TEST_CHAT_ID, 1)).toBe("* Beta: second");
  });

  it("stores custom answers per question and prioritizes them in final answers", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION, MULTIPLE_QUESTION], "req-3");

    questionManager.selectOption(TEST_CHAT_ID, 0, 1);
    questionManager.selectOption(TEST_CHAT_ID, 1, 0);
    questionManager.setCustomAnswer(TEST_CHAT_ID, 1, "Custom response for question #2");

    expect(questionManager.hasCustomAnswer(TEST_CHAT_ID, 1)).toBe(true);
    expect(questionManager.getCustomAnswer(TEST_CHAT_ID, 1)).toBe("Custom response for question #2");

    const answers = questionManager.getAllAnswers(TEST_CHAT_ID);
    expect(answers).toEqual([
      { question: SINGLE_QUESTION.question, answer: "* No: decline" },
      { question: MULTIPLE_QUESTION.question, answer: "Custom response for question #2" },
    ]);
  });

  it("tracks custom input mode and active message id", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION, MULTIPLE_QUESTION], "req-3b");

    expect(questionManager.getActiveMessageId(TEST_CHAT_ID)).toBeNull();
    expect(questionManager.isWaitingForCustomInput(TEST_CHAT_ID, 0)).toBe(false);

    questionManager.setActiveMessageId(TEST_CHAT_ID, 123);
    expect(questionManager.isActiveMessage(TEST_CHAT_ID, 123)).toBe(true);
    expect(questionManager.isActiveMessage(TEST_CHAT_ID, 999)).toBe(false);

    questionManager.startCustomInput(TEST_CHAT_ID, 0);
    expect(questionManager.isWaitingForCustomInput(TEST_CHAT_ID, 0)).toBe(true);

    questionManager.nextQuestion(TEST_CHAT_ID);
    expect(questionManager.getActiveMessageId(TEST_CHAT_ID)).toBeNull();
    expect(questionManager.isWaitingForCustomInput(TEST_CHAT_ID, 0)).toBe(false);
  });

  it("returns copied message IDs and supports cancel/clear", () => {
    questionManager.startQuestions(TEST_CHAT_ID, [SINGLE_QUESTION], "req-4");
    questionManager.addMessageId(TEST_CHAT_ID, 10);
    questionManager.addMessageId(TEST_CHAT_ID, 11);

    const messageIds = questionManager.getMessageIds(TEST_CHAT_ID);
    messageIds.push(999);
    expect(questionManager.getMessageIds(TEST_CHAT_ID)).toEqual([10, 11]);

    questionManager.cancel(TEST_CHAT_ID);
    expect(questionManager.isActive(TEST_CHAT_ID)).toBe(false);

    questionManager.clear(TEST_CHAT_ID);
    expect(questionManager.getTotalQuestions(TEST_CHAT_ID)).toBe(0);
    expect(questionManager.getRequestID(TEST_CHAT_ID)).toBeNull();
    expect(questionManager.getCurrentQuestion(TEST_CHAT_ID)).toBeNull();
  });
});
