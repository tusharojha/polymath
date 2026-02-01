import type { Agent, AgentInput, AgentUpdate } from "../types";

export class RevisionDepthAgent implements Agent {
  id = "revision-depth-agent";
  role = "revision-depth" as const;
  priority = 60;

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    if (input.state.phase !== "learning") {
      return null;
    }
    const depth = input.state.depthLevel;
    const thesis = input.state.thesis;
    if (!thesis) {
      return null;
    }

    if (depth < 3 && thesis.confidence > 0.6) {
      return {
        intents: [
          {
            type: "deepen-topic",
            topic: input.state.goal.title,
            depthTarget: (depth + 1) as typeof depth,
          },
        ],
      };
    }

    if (thesis.confidence < 0.4) {
      return {
        intents: [
          {
            type: "schedule-revision",
            concept: "core foundations",
            dueAt: input.now + 1000 * 60 * 60 * 24,
            reason: "Low confidence signal. Reinforce baseline knowledge.",
          },
        ],
      };
    }

    return {
      intents: [
        {
          type: "apply-practice",
          prompt: "Build a small prototype or simulation from the concept.",
          mode: "project",
        },
      ],
    };
  }
}
