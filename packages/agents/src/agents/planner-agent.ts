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
1. "ask-questions": If we need more context on user goals/background.
2. "draft-curriculum": If we are ready to build the first-principles map.
3. "orchestrate-sense": Trigger a specific sense (e.g. background music, infographic request) based on the "Understanding Thesis".
4. "none": If waiting for other agents.

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
      const intents: any[] = [];
      if (!state.questions) intents.push({ type: "ask-questions", topic: state.goal.title });
      if (!state.curriculum && state.answers) {
        intents.push({ type: "draft-curriculum", topic: state.goal.title, knowledgeLevel: state.knowledgeLevel });
      }
      return { statePatch, intents };
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
        phase: state.phase
      });

      const response = await this.llm.generate(`${PLAN_PROMPT}\n\nContext: ${context}`);
      const parsed = JSON.parse(response);

      const intents: any[] = [];
      if (parsed.decision === "ask-questions") {
        intents.push({ type: "ask-questions", topic: state.goal.title });
      } else if (parsed.decision === "draft-curriculum" && !state.curriculum) {
        intents.push({
          type: "draft-curriculum",
          topic: state.goal.title,
          knowledgeLevel: state.knowledgeLevel,
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
