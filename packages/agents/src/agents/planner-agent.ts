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

Return STRICT JSON:
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

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state, now } = input;

    // 1. Ensure thesis graph exists
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
      // Fallback to legacy logic if no LLM
      // 1. PHASE GUARD: If we have questions but no answers, we MUST stay in questionnaire.
      if (state.questions?.length && (!state.answers || Object.keys(state.answers).length === 0)) {
        return {
          statePatch: { phase: "questionnaire" },
          intents: [{ type: "ask-questions", topic: state.goal.title }]
        };
      }

      const amendSignal = state.recentSignals?.find(
        (s: any) => s.payload?.kind === "amend-curriculum"
      );
      if (amendSignal && amendSignal.payload?.request) {
        return {
          statePatch,
          intents: [
            {
              type: "amend-curriculum",
              topic: state.goal.title,
              request: String(amendSignal.payload.request),
            },
          ],
        };
      }

      // 2. CURRICULUM GUARD: If no curriculum and we have answers, draft it.
      if (!state.curriculum && !state.curriculumLocked && state.answers && Object.keys(state.answers).length > 0) {
        const intents: any[] = [];
        if (!state.pendingIntents.some(i => i.type === "draft-curriculum")) {
          intents.push({ type: "draft-curriculum", topic: state.goal.title, knowledgeLevel: state.knowledgeLevel });
        }
        return { statePatch, intents };
      }

      return { statePatch, intents: [] };
    }

    try {
      console.log('full planner state', state)
      const context = JSON.stringify({
        topic: state.goal.title,
        thesisConfidence: state.thesis?.confidence,
        hasQuestions: !!state.questions,
        hasAnswers: !!state.answers,
        hasCurriculum: !!state.curriculum,
        recentAnswers: state.answers,
        valueVector: state.valueVector, // Curiosity, Depth, Practice, Revision, Collaboration
        phase: state.phase
      });

      const response = await this.llm.generate(`${PLAN_PROMPT}\n\nContext: ${context}`);
      const parsed = JSON.parse(response);

      const intents: any[] = [];
      const amendSignal = state.recentSignals?.find(
        (s: any) => s.payload?.kind === "amend-curriculum"
      );
      if (amendSignal && amendSignal.payload?.request) {
        intents.push({
          type: "amend-curriculum",
          topic: state.goal.title,
          request: String(amendSignal.payload.request),
        });
      }
      if (parsed.decision === "ask-questions") {
        intents.push({ type: "ask-questions", topic: state.goal.title });
      } else if (parsed.decision === "draft-curriculum" && !state.curriculum && !state.curriculumLocked) {
        intents.push({
          type: "draft-curriculum",
          topic: state.goal.title,
          knowledgeLevel: state.knowledgeLevel,
        });
      } else if (parsed.decision === "begin-teaching") {
        intents.push({
          type: "begin-teaching",
          unitId: state.curriculum?.modules?.[0]?.units?.[0]?.id
        });
      } else if (parsed.decision === "orchestrate-sense" && parsed.sense) {
        intents.push({
          type: "present-sense",
          sense: parsed.sense,
          prompt: parsed.reasoning
        });
      }

      return {
        statePatch,
        intents,
        notes: [parsed.reasoning],
      };
    } catch (err) {
      return { statePatch, notes: ["Planner failed to decide: " + (err as Error).message] };
    }
  }
}
