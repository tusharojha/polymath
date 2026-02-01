import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const QUESTION_PROMPT = `You are the Polymath Question Agent.
Create 4 short questions to assess the user's background on the topic.
Return STRICT JSON format:
{
  "questions": [
    { "id": "q1", "prompt": "string", "kind": "text" | "choice", "choices": ["a","b"] }
  ]
}`;

function fallbackQuestions(topic: string) {
  return [
    { id: "q1", prompt: `How would you explain ${topic} in one sentence?`, kind: "text" },
    { id: "q2", prompt: `Have you studied ${topic} before?`, kind: "choice", choices: ["No", "Some basics", "Intermediate", "Advanced"] },
    { id: "q3", prompt: `What is your main goal with ${topic}?`, kind: "text" },
    { id: "q4", prompt: `Rate your confidence with ${topic} (0-10).`, kind: "text" },
  ];
}

export class QuestionAgent implements Agent {
  id = "question-agent";
  role = "planner" as const;
  priority = 85;
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const requested = input.state.pendingIntents.find(
      (intent) => intent.type === "ask-questions"
    );
    if (!requested || requested.type !== "ask-questions") {
      return null;
    }

    let questions = fallbackQuestions(input.state.goal.title);
    if (this.llm) {
      try {
        const text = await this.llm.generate(`${QUESTION_PROMPT}\nTopic: ${input.state.goal.title}`);
        const parsed = JSON.parse(text) as { questions?: typeof questions };
        if (parsed.questions && parsed.questions.length > 0) {
          questions = parsed.questions;
        }
      } catch {
        // fallback
      }
    }

    return {
      statePatch: {
        phase: "questionnaire",
        questions: questions as any,
      },
    };
  }
}
