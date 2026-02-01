import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const CHECK_PROMPT = `You are a strict but fair grader.
Evaluate the user's answer for correctness and provide a one-line feedback.
Return STRICT JSON: { "ok": true|false, "message": "short feedback" }.

QUESTION: {{question}}
EXPECTED: {{expected}}
USER_ANSWER: {{answer}}
ANSWER_TYPE: {{answerType}}
`;

export class QuizCheckAgent implements Agent {
  id = "quiz-check-agent";
  role = "teaching" as const;
  priority = 85;

  constructor(private readonly llm: LLMClient) {}

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const signal = input.newSignals.find(
      (s) => s.payload?.kind === "ui-intent" && s.payload?.action === "check-quiz"
    );
    if (!signal) return null;

    const data = signal.payload?.data as any;
    const unitId = data?.unitId as string | undefined;
    const mediaIndex = data?.mediaIndex as number | undefined;
    const question = (data?.question || "").toString();
    const expected = (data?.expected || "").toString();
    const answer = (data?.answer || "").toString();
    const answerType = (data?.answerType || "text").toString();

    if (!unitId || typeof mediaIndex !== "number") return null;

    try {
      if (!this.llm) {
        const ok = answer.trim().toLowerCase() === expected.trim().toLowerCase();
        return {
          statePatch: {
            quizResults: {
              ...(input.state.quizResults || {}),
              [`${unitId}:${mediaIndex}`]: {
                ok,
                message: ok ? "Correct." : "Not quite. Try again."
              }
            }
          }
        };
      }

      const response = await this.llm.generate(
        CHECK_PROMPT
          .replace("{{question}}", question)
          .replace("{{expected}}", expected)
          .replace("{{answer}}", answer)
          .replace("{{answerType}}", answerType)
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        statePatch: {
          quizResults: {
            ...(input.state.quizResults || {}),
            [`${unitId}:${mediaIndex}`]: {
              ok: !!parsed.ok,
              message: parsed.message || (parsed.ok ? "Correct." : "Not quite.")
            }
          }
        }
      };
    } catch (err) {
      console.error("QuizCheckAgent failed:", err);
      return null;
    }
  }
}
