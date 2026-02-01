import type { Agent, AgentInput, AgentUpdate, TeachingContent } from "../types";
import type { LLMClient } from "../llm/types";

const TEACHING_PROMPT = `You are the Polymath Principal Teaching Agent. 
Your goal is to provide a deep, professional, and world-class explanation of a concept using First-Principles. You are teaching, not testing. Do not ask the user to explain anything.

UNIT: {{unitTitle}}
RATIONALE: {{unitRationale}}
USER LEVEL: {{userLevel}}
USER CONTEXT: {{userContext}}
DEPTH CAP: {{depthCap}}
MAX SENSES: {{maxSenses}}

INSTRUCTIONS:
1. Long-form Exposition: Provide a comprehensive markdown explanation. Start from irreducible primitives and build up to complex interactions.
   - If USER LEVEL is "beginner", keep explanations concrete and avoid jargon.
   - If USER LEVEL is "intermediate", add formal terms with brief definitions.
   - If USER LEVEL is "advanced", emphasize nuances, edge cases, and trade-offs.
   - Respect DEPTH CAP: do not go beyond this depth level in the initial pass.
2. Integrated "Senses": Suggest specific visuals, infographics, experiments, or research citations to ground the theory. Do not exceed MAX SENSES.
3. RICH CONTENT:
    - **Tables**: Use markdown tables for comparisons or structured data.
    - **Math (KaTeX)**: Use standard LaTeX notation for equations (e.g. $E=mc^2$ or $$H = \sum p_i \log p_i$$).
    - **Mermaid Diagrams**: Use valid Mermaid.js syntax for mind maps, flowcharts, or architecture. Indicate with kind: "mermaid".
    - **Quick Checks**: When helpful, add 1–2 short quizzes using kind: "quiz" with question + answer (and choices if multiple choice).
4. Inline Layout: You MUST interleave media and senses within the text. Use markers like \`::media:N::\` or \`::sense:N::\`.
5. Rich Media: Include at least 1-2 professional diagrams (SVG or Mermaid).

Return STRICT JSON format:
{
  "explanation": "Markdown text (with tables/math) and ::media:0:: markers.",
  "firstPrinciples": ["primitive 1", "primitive 2"],
  "media": [
    { "kind": "svg" | "mermaid" | "markdown" | "code" | "quiz", "title": "Optional title", "content": "The actual SVG code or Mermaid code or markdown", "language": "js|ts|python|none", "question": "Optional for quiz", "choices": ["A","B"], "answer": "Expected answer", "answerType": "text|choice" }
  ],
  "senses": [
    { "type": "visual" | "sound" | "infographic" | "experiment", "prompt": "precise description", "reasoning": "educational value" }
  ],
  "interjections": []
}
`;

export class TeachingAgent implements Agent {
  id = "teaching-agent";
  role = "teaching" as const;
  priority = 70;

  constructor(private readonly llm: LLMClient) { }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state, newSignals } = input;

    // Look for a signal to open a specific unit or a planner intent
    const openSignal = newSignals.find(s =>
      s.payload?.kind === "ui-intent" && s.payload?.action === "open-unit"
    );

    const beginIntent = state.pendingIntents.find(i => i.type === "begin-teaching") as any;

    const openData = (openSignal?.payload?.data as any) || {};
    const unitIdFromSignal = openData.unitId as string | undefined;
    const unitTitleFromSignal = openData.unitTitle as string | undefined;
    let unitId = unitIdFromSignal || beginIntent?.unitId || state.pendingUnitId || null;
    if (!unitId && !unitTitleFromSignal) return null;

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
    const unit = this.findUnit(state.curriculum, unitId, unitTitleFromSignal);
    if (!unit) return null;
    unitId = unit.id;

    const userLevel =
      (state.answers?.experienceLevel || state.answers?.backgroundLevel || "").toString().toLowerCase() ||
      (state.knowledgeLevel >= 4 ? "advanced" : state.knowledgeLevel >= 2 ? "intermediate" : "beginner");
    const userContext = JSON.stringify(state.answers ?? {});

    const maxSenses = 2;
    const depthCap = Math.max(1, Math.min(5, state.depthLevel || 2));

    const prompt = TEACHING_PROMPT
      .replace("{{unitTitle}}", unit.title)
      .replace("{{unitRationale}}", (unit as any).objective || "Foundational concept")
      .replace("{{userLevel}}", userLevel)
      .replace("{{userContext}}", userContext)
      .replace("{{depthCap}}", String(depthCap))
      .replace("{{maxSenses}}", String(maxSenses));

    try {
      const response = await this.llm.generate(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);

      const teachingContent: TeachingContent = {
        unitId,
        title: unit.title,
        explanation: parsed.explanation || parsed.summary || "Generating lesson content...",
        firstPrinciples: parsed.firstPrinciples ?? [],
        media: Array.isArray(parsed.media) ? parsed.media : [],
        senses: (parsed.senses ?? []).slice(0, maxSenses),
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

  private findUnit(curriculum: any, unitId?: string | null, unitTitle?: string): any {
    if (!curriculum?.modules) return null;
    if (unitId) {
      for (const mod of curriculum.modules) {
        const unit = mod.units?.find((u: any) => u.id === unitId);
        if (unit) return unit;
      }
    }
    if (unitTitle) {
      const normalized = unitTitle.toLowerCase();
      for (const mod of curriculum.modules) {
        const unit = mod.units?.find((u: any) => (u.title || "").toLowerCase() === normalized);
        if (unit) return unit;
      }
    }
    return null;
  }
}
