import { opencodeClient } from "../opencode/client.js";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPTS: Record<string, string> = {
  summarise: `You are a summarization expert. Condense the user's text into clear, actionable bullet points. Focus on the 3-5 most important takeaways. Be concise but comprehensive. Return only the summary, no preamble.`,
  eli5: `Explain this concept as if talking to a 5-year-old. Rules:
 1. Use words with maximum 2 syllables
 2. Keep sentences very short (under 10 words)
 3. Include a fun example or analogy
 4. Be playful and friendly
 5. No jargon or technical terms`,
  deep_research: `You are a research expert conducting thorough investigation. Use available search tools to find comprehensive information. Structure your response with:
 1. Executive summary
 2. Key findings (with sources)
 3. Supporting evidence
 4. Conclusions
 5. Areas of uncertainty

 Be thorough and cite sources where possible.`,
  steel_man: `You are presenting the strongest possible argument FOR the given position. Your job:
 1. Ignore all weaknesses and counterarguments
 2. Focus ONLY on the best reasons supporting this view
 3. Make the strongest case possible
 4. Use compelling logic and evidence
 5. Acknowledge the opposing view exists but don't dwell on it

 Present the most persuasive version of this argument.`,
  feynman: `Use the Feynman technique to teach this concept:

 Step 1 - Simple Explanation: Explain it in the simplest terms possible, as if teaching to a curious teenager.

 Step 2 - Analogy: Use a relatable analogy or real-world example that makes it click.

 Step 3 - Identify Gaps: If you were asked to explain this to a child and got stuck, note where the gaps in understanding would be.

 Make it memorable and clear.`,
  devils_advocate: `Play devil's advocate. Argue the OPPOSITE position to what the user presented. Your job:
 1. Give the strongest arguments for the opposing view
 2. Point out flaws in the original position
 3. Make the opposing side seem more reasonable
 4. Use logical reasoning and evidence
 5. Be intellectually honest but persuasive

 Challenge the user's assumption and present the best counter-argument.`,
};

export async function resolveInlineQuery(
  command: string,
  query: string,
  modelProvider?: string,
  modelId?: string,
): Promise<string> {
  let sessionId: string | null = null;
  const abortController = new AbortController();

  try {
    // Create session without a directory — uses OpenCode's default/global context.
    // DO NOT use a temp dir: OpenCode only emits events for known project directories,
    // so filtering by a temp dir would yield zero events and always time out.
    const { data: session, error: sessionError } = await opencodeClient.session.create({});

    if (sessionError || !session) {
      logger.error("[InlineLLM] Failed to create session:", sessionError);
      throw new Error("Failed to create inline session");
    }

    sessionId = session.id;
    logger.debug(`[InlineLLM] Created session ${sessionId} (no directory — global context)`);

    const systemPrompt = SYSTEM_PROMPTS[command] ?? "Answer the following concisely.";
    const fullPrompt = `${systemPrompt}\n\n---\n\nUSER'S QUESTION/CONTENT:\n${query}`;

    const textChunks: string[] = [];
    const capturedSessionId = sessionId;

    const responsePromise = new Promise<string>((resolve, reject) => {
      (async () => {
        try {
          // Subscribe globally (no directory filter). Filter by sessionID in the loop
          // so we only capture events for THIS inline session, not unrelated ones.
          const result = await opencodeClient.event.subscribe(
            {},
            { signal: abortController.signal },
          );

          if (!result.stream) {
            reject(new Error("No SSE stream returned from event subscription"));
            return;
          }

          for await (const event of result.stream) {
            if (event.type === "message.part.updated") {
              const part = (
                event.properties as { part: { type: string; text?: string; sessionID?: string } }
              ).part;
              if (part.sessionID !== capturedSessionId) continue;
              if (part.type === "text" && part.text) {
                textChunks.push(part.text);
              }
            } else if (event.type === "message.updated") {
              const info = (
                event.properties as { info: { role: string; sessionID?: string } }
              ).info;
              if (info.sessionID !== capturedSessionId) continue;
              if (info.role === "assistant") {
                const answer = textChunks.join("");
                logger.debug(
                  `[InlineLLM] Got response (${answer.length} chars) for ${command}:${query.slice(0, 30)}`,
                );
                resolve(answer.slice(0, 4096));
                return;
              }
            }
          }
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            logger.error("[InlineLLM] SSE stream error:", err);
            reject(err as Error);
          }
        }
      })();
    });

    const promptOptions: {
      sessionID: string;
      parts: { type: "text"; text: string }[];
      model?: { providerID: string; modelID: string };
    } = {
      sessionID: sessionId,
      parts: [{ type: "text" as const, text: fullPrompt }],
    };

    if (modelProvider && modelId) {
      promptOptions.model = { providerID: modelProvider, modelID: modelId };
    }

    await opencodeClient.session.prompt(promptOptions);

    // Give local LLM inference time to generate a response (local models are slower than cloud)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Inline query timeout after 60 seconds")), 60_000);
    });

    const answer = await Promise.race([responsePromise, timeoutPromise]);
    return answer;
  } finally {
    abortController.abort();

    if (sessionId) {
      try {
        await opencodeClient.session.delete({ sessionID: sessionId });
        logger.debug(`[InlineLLM] Deleted session ${sessionId}`);
      } catch (err) {
        logger.warn(`[InlineLLM] Failed to delete session ${sessionId}:`, err);
      }
    }
  }
}
