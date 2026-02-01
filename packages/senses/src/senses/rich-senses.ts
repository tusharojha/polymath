import { runExperimentSense } from "./experiment-sense";
import { runInfographicSense } from "./infographic-sense";

export async function runSenses(
  intents: any[],
  context: any,
  llm?: { generate: (p: string) => Promise<string> }
): Promise<any[]> {
  const results = [];
  for (const intent of intents) {
    if (intent.type === "present-sense") {
      // Mocking rich data for now, but this could call external APIs or LLMs
      const artifacts = [];

      if (intent.sense === "experiment" && llm) {
        const output = await runExperimentSense(
          {
            context: { goal: context.goal, userId: context.userId },
            prompt: intent.prompt,
            params: intent.params,
          },
          llm
        );
        results.push({
          id: intent.id || `sense-out-${Date.now()}`,
          sense: intent.sense,
          artifacts: output.artifacts ?? [],
        });
        continue;
      }

      if (intent.sense === "infographic" && llm && (llm as any).generateImage) {
        const output = await runInfographicSense(
          {
            context: { goal: context.goal, userId: context.userId },
            prompt: intent.prompt,
            params: intent.params,
          },
          llm as any
        );
        results.push({
          id: intent.id || `sense-out-${Date.now()}`,
          sense: intent.sense,
          artifacts: output.artifacts ?? [],
        });
        continue;
      }

      if (intent.sense === "visual") {
        artifacts.push({
          kind: "diagram",
          title: "Visual Model",
          description: "A first-principles decomposition scroll.",
          data: {
            nodes: [{ id: "1", label: "Primitive A" }],
            edges: []
          }
        });
      } else if (intent.sense === "paper") {
        artifacts.push({
          kind: "text",
          title: "Evidence grounding",
          description: "Isolating the core mechanism.",
          content: "The primary constraint of this system is..."
        });
      }

      results.push({
        id: intent.id || `sense-out-${Date.now()}`,
        sense: intent.sense,
        artifacts
      });
    }
  }
  return results;
}
