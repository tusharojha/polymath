import type { Agent, AgentInput, AgentUpdate } from "../types";

export class SynthesisAgent implements Agent {
  id = "synthesis-agent";
  role = "synthesis" as const;
  priority = 50;

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    if (input.state.phase !== "learning") {
      return null;
    }
    const thesis = input.state.thesis;
    if (!thesis) {
      return null;
    }

    return {
      intents: [
        {
          type: "request-output",
          artifactType: "insight",
          prompt:
            "Write a short explanation of the concept in your own words and list one novel application.",
        },
      ],
    };
  }
}
