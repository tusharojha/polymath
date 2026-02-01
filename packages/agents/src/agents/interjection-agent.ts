import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const INTERJECTION_PROMPT = `You are the Interjection Sub-Agent supporting the Teaching Agent.
Your job is to add *minimal* insight interjections to reinforce understanding without turning into a quiz.

RULES:
- At most 2 interjections.
- Each interjection must be a short declarative insight (not a question).
- Only include interjections if they add real clarity; otherwise return an empty list.

UNIT: {{unitTitle}}
OBJECTIVE: {{unitObjective}}
SUMMARY: {{summary}}

Return STRICT JSON format:
{ "interjections": [ { "question": "insight title (declarative)", "answer": "clear explanation", "motivation": "why this matters" } ] }`;

export class InterjectionAgent implements Agent {
  id = "interjection-agent";
  role = "teaching" as const;
  priority = 65;

  constructor(private readonly llm: LLMClient) { }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state } = input;
    const unitId = state.activeStep?.unitId;
    if (!unitId) return null;

    const teachingContent = state.knowledgeRepository?.[unitId];
    if (!teachingContent) return null;
    if (teachingContent.interjections && teachingContent.interjections.length > 0) return null;

    const unit = this.findUnit(state.curriculum, unitId);
    if (!unit) return null;

    try {
      const prompt = INTERJECTION_PROMPT
        .replace("{{unitTitle}}", unit.title)
        .replace("{{unitObjective}}", unit.objective || "Foundational objective")
        .replace("{{summary}}", (teachingContent.explanation || "").slice(0, 800));

      const response = await this.llm.generate(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      const interjections = Array.isArray(parsed.interjections) ? parsed.interjections.slice(0, 2) : [];

      return {
        statePatch: {
          knowledgeRepository: {
            ...state.knowledgeRepository,
            [unitId]: {
              ...teachingContent,
              interjections,
            },
          },
        },
        notes: interjections.length > 0 ? ["Interjection sub-agent added minimal insights."] : ["Interjection sub-agent skipped (not needed)."],
      };
    } catch (err) {
      console.error("InterjectionAgent failed:", err);
      return null;
    }
  }

  private findUnit(curriculum: any, unitId: string): any {
    if (!curriculum?.modules) return null;
    for (const mod of curriculum.modules) {
      const unit = mod.units?.find((u: any) => u.id === unitId);
      if (unit) return unit;
    }
    return null;
  }
}
