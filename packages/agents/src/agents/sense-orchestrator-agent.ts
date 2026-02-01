import type { Agent, AgentInput, AgentUpdate } from "../types";

export class SenseOrchestratorAgent implements Agent {
  id = "sense-orchestrator-agent";
  role = "sense-orchestrator" as const;
  priority = 85;

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const thesis = input.state.thesis;
    const step = input.state.activeStep;
    const graph = input.state.thesisGraph;
    if (input.state.phase && input.state.phase !== "learning" && input.state.phase !== "intake") {
      return null;
    }
    if (!thesis) {
      return {
        intents: [
          {
            type: "present-sense",
            sense: "visual",
            prompt: "Establish a shared mental model with an overview visual.",
          },
        ],
      };
    }

    if (step) {
      if (graph && graph.nodes.length > 0) {
        const weakest = [...graph.nodes].sort((a, b) => a.confidence - b.confidence)[0];
        if (weakest && weakest.preferredSense) {
          return {
            intents: [
              {
                type: "present-sense",
                sense: weakest.preferredSense as any,
                prompt: `Reinforce ${weakest.label} with preferred modality.`,
              },
            ],
          };
        }
      }
      return {
        intents: step.senses.map((sense) => ({
          type: "present-sense" as const,
          sense: sense as any,
          prompt: step.rationale,
        })),
      };
    }

    if (thesis.confidence < 0.5) {
      return {
        intents: [
          {
            type: "present-sense",
            sense: "infographic",
            prompt: "Offer a crisp, evidence-backed explanation.",
          },
        ],
      };
    }

    return {
      intents: [
        {
          type: "present-sense",
          sense: "experiment",
          prompt: "Guide an interactive experiment to test understanding.",
        },
      ],
    };
  }
}
