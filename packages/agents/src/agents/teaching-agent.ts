import type { Agent, AgentInput, AgentUpdate, TeachingContent } from "../types";
import type { LLMClient } from "../llm/types";

const TEACHING_PROMPT = `You are the Polymath Principal Teaching Agent. 
Your goal is to provide a deep, professional, and world-class explanation of a concept using First-Principles.

UNIT: {{unitTitle}}
RATIONALE: {{unitRationale}}

INSTRUCTIONS:
1. Long-form Exposition: Provide a comprehensive markdown explanation. Start from irreducible primitives and build up to complex interactions. Be professional, clear, and authoritative.
2. Systemic Depth: Show exactly how this concept functions as a fundamental "brick" in the specialist's wall.
3. Curiosity & Storytelling: Frame the knowledge in a way that makes the user want to know more. Use analogies that stick.
4. Integrated "Senses": Suggest specific visuals, infographics, or research citations to ground the theory.
5. Check-in Interjections: Provide 1-2 subtle questions with satisfying answers to help the user self-verify their mental model.

Return STRICT JSON:
{
  "explanation": "Deep markdown explanation starting with primitives",
  "firstPrinciples": ["primitive 1", "primitive 2"],
  "senses": [
    { "type": "visual" | "sound" | "infographic", "prompt": "precise description for the orchestrator", "reasoning": "educational value" }
  ],
  "interjections": [
    { "question": "self-verification question", "answer": "clear answer", "motivation": "why this concept is a superpower" }
  ]
}
`;

export class TeachingAgent implements Agent {
  id = "teaching-agent";
  role = "teaching" as const;
  priority = 90;

  constructor(private readonly llm: LLMClient) { }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state, newSignals } = input;

    // Look for a signal to open a specific unit or a planner intent
    const openSignal = newSignals.find(s =>
      s.payload?.kind === "ui-intent" && s.payload?.action === "open-unit"
    );

    const beginIntent = state.pendingIntents.find(i => i.type === "begin-teaching") as any;

    const unitId = (openSignal?.payload?.data as any)?.unitId || beginIntent?.unitId || state.pendingUnitId;
    if (!unitId) return null;

    // Check if we already have this in the repository
    if (state.knowledgeRepository?.[unitId]) {
      // Just set it as active if it's not already
      if (state.activeStep?.unitId === unitId) return null;

      const content = state.knowledgeRepository[unitId];
      return {
        statePatch: {
          activeStep: {
            id: `step-${unitId}`,
            goalId: state.goal.id,
            title: content.title,
            rationale: content.explanation,
            senses: content.senses.map(s => s.type as any),
            prompts: content.senses.map(s => s.prompt),
            unitId: unitId
          },
          pendingUnitId: null
        },
        notes: [`Retrieved teaching content for ${content.title} from repository.`]
      };
    }

    // Find the unit in the curriculum
    const unit = this.findUnit(state.curriculum, unitId);
    if (!unit) return null;

    const prompt = TEACHING_PROMPT
      .replace("{{unitTitle}}", unit.title)
      .replace("{{unitRationale}}", (unit as any).objective || "Foundational concept");

    try {
      const response = await this.llm.generate(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);

      const teachingContent: TeachingContent = {
        unitId,
        title: unit.title,
        explanation: parsed.explanation,
        firstPrinciples: parsed.firstPrinciples ?? [],
        senses: parsed.senses ?? [],
        interjections: parsed.interjections ?? []
      };

      return {
        statePatch: {
          knowledgeRepository: {
            ...state.knowledgeRepository,
            [unitId]: teachingContent
          },
          activeStep: {
            id: `step-${unitId}`,
            goalId: state.goal.id,
            title: unit.title,
            rationale: parsed.explanation,
            senses: teachingContent.senses.map(s => s.type as any),
            prompts: teachingContent.senses.map(s => s.prompt),
            unitId: unitId
          },
          pendingUnitId: null
        },
        notes: [`Generated deep first-principles lesson for ${unit.title}.`]
      };
    } catch (err) {
      console.error("TeachingAgent failed:", err);
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
