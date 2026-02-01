import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const PLAN_PROMPT = `You are the Polymath Strategic Orchestrator.
We are building Polymath, a "Fluid Operating System" for learning.
The goals is to help users become polymaths by improving five core values:
1. Curiosity: Encouraging exploration of diverse topics.
2. Depth: Reaching first-principles understanding.
3. Practical Usage: Building apps or experiments.
4. Revision: Spaced repetition and memory consolidation.
5. Collaboration: Sharing and synthesizing with others.

Your role is to orchestrate "Learning Steps" using "Senses":
- Senses: sounds (music), infographics, animations, slides, visuals, characters, experiment designer, research papers, industry updates.

Decisions:
1. "ask-questions": If we need more context on user goals/background. (Avoid if hasAnswers is true and thesisConfidence > 0.4).
2. "draft-curriculum": If we are ready to build the first-principles map. (Prioritize if hasAnswers is true).
3. "begin-teaching": If curriculum exists and we should start the first unit. (Prioritize immediately after draft-curriculum).
4. "orchestrate-sense": Trigger a specific sense (e.g. background music, infographic request) based on the "Understanding Thesis".
5. "none": If waiting for other agents.

Transition Rule: If hasAnswers is true and hasQuestions is true, move to draft-curriculum unless the user explicitly requested more questions.
If hasCurriculum is true and no activeStep is set, move to begin-teaching.
Do NOT get stuck in a questionnaire loop.

Analyze the Thesis (direct signals: words/clicks; indirect: attention/time) and decide the next move to maximize the Polymath Values.

Return STRICT JSON format:
{ 
  "decision": "ask-questions" | "draft-curriculum" | "orchestrate-sense" | "none", 
  "sense": string (if decision is orchestrate-sense),
  "reasoning": "string" 
}`;

export class PlannerAgent implements Agent {
  id = "planner-agent";
  role = "planner" as const;
  priority = 90;

  constructor(private readonly llm?: LLMClient) { }

  private ruleBasedDecision(input: AgentInput): AgentUpdate | null {
    const { state, newSignals } = input;

    // RULE: If clicking open-unit, stay in learning and ensure we are teaching
    const openSignal = newSignals.find(s => s.payload?.kind === "ui-intent" && (s.payload?.action === "open-unit" || s.payload?.action === "none"));
    if (openSignal) {
      const unitId = (openSignal.payload?.data as any)?.unitId || state.activeStep?.unitId;
      if (unitId) {
        return {
          statePatch: { phase: "learning" },
          intents: [{ type: "begin-teaching", unitId }]
        };
      }
    }

    // RULE: If advancing to next unit
    const nextSignal = newSignals.find(s => s.payload?.kind === "ui-intent" && s.payload?.action === "next-unit");
    if (nextSignal && state.curriculum) {
      const currentUnitId = state.activeStep?.unitId;
      const allUnits = state.curriculum.modules.flatMap(m => m.units);
      const currentIndex = allUnits.findIndex(u => u.id === currentUnitId);
      const nextUnit = allUnits[currentIndex + 1];
      if (nextUnit) {
        return {
          statePatch: { phase: "learning" },
          intents: [{ type: "begin-teaching", unitId: nextUnit.id }]
        };
      }
    }

    // RULE: Intake submission
    const submitSignal = newSignals.find(s => s.payload?.kind === "ui-intent" && s.payload?.action === "submit-answers");
    if (submitSignal && state.phase === "intake") {
      return {
        intents: [{ type: "draft-curriculum", topic: state.goal.title, knowledgeLevel: state.knowledgeLevel }]
      };
    }

    return null;
  }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state, now, newSignals } = input;

    // 1. Selective Bypass: If the signal is purely navigational, skip planning
    const isNavigational = newSignals.some(s =>
      s.payload?.kind === "ui-intent" && (s.payload?.action === "open-unit" || s.payload?.action === "none")
    );
    if (isNavigational && state.phase === "learning") {
      return null;
    }

    // 2. Rule-based fast track (Zero LLM cost)
    const fastDecision = this.ruleBasedDecision(input);
    if (fastDecision) return fastDecision;

    // 3. Ensure thesis graph exists
    const statePatch: any = {};
    if (!state.thesisGraph) {
      statePatch.thesisGraph = {
        id: `thesis-${state.goal.id}`,
        nodes: [
          {
            id: `concept-${state.goal.id}`,
            label: state.goal.title,
            confidence: 0.1,
            decayRate: 0.02,
            lastInteractionAt: now,
          },
        ],
        edges: [],
      };
      statePatch.phase = "intake";
    }

    if (!this.llm) {
      if (state.questions?.length && (!state.answers || Object.keys(state.answers).length === 0)) {
        return {
          statePatch: { phase: "questionnaire" },
          intents: [{ type: "ask-questions", topic: state.goal.title }]
        };
      }
      return { statePatch, intents: [] };
    }

    try {
      const context = JSON.stringify({
        topic: state.goal.title,
        hasQuestions: !!state.questions,
        hasAnswers: !!state.answers,
        hasCurriculum: !!state.curriculum,
        phase: state.phase
      });

      const response = await this.llm.generate(`${PLAN_PROMPT}\n\nContext: ${context}`);
      const parsed = JSON.parse(response);

      const intents: any[] = [];
      if (parsed.decision === "ask-questions") {
        intents.push({ type: "ask-questions", topic: state.goal.title });
      } else if (parsed.decision === "draft-curriculum" && !state.curriculum) {
        intents.push({ type: "draft-curriculum", topic: state.goal.title, knowledgeLevel: state.knowledgeLevel });
      } else if (parsed.decision === "begin-teaching") {
        intents.push({ type: "begin-teaching", unitId: state.curriculum?.modules?.[0]?.units?.[0]?.id });
      }

      return { statePatch, intents, notes: [parsed.reasoning] };
    } catch (err) {
      return { statePatch, notes: ["Planner failed: " + (err as Error).message] };
    }
  }
}
