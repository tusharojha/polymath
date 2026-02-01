export async function runSenses(intents: any[], context: any): Promise<any[]> {
  const results = [];
  for (const intent of intents) {
    if (intent.type === "present-sense") {
      // Mocking rich data for now, but this could call external APIs or LLMs
      const artifacts = [];

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
