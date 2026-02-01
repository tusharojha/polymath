import type { Agent, AgentInput, AgentUpdate } from "../types";

export class SenseOrchestratorAgent implements Agent {
  id = "sense-orchestrator-agent";
  role = "sense-orchestrator" as const;
  priority = 85;

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state, newSignals } = input;
    const thesis = state.thesis;
    const step = state.activeStep;
    const graph = state.thesisGraph;

    // Selective Bypass: If purely navigational or unit already has content, skip
    const isNavigational = newSignals.some(s => s.payload?.kind === "ui-intent" && s.payload?.action === "open-unit");
    const hasContent = step?.unitId && state.knowledgeRepository?.[step.unitId];
    if (isNavigational && hasContent) {
      return null;
    }

    if (state.phase && state.phase !== "learning" && state.phase !== "intake") {
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
