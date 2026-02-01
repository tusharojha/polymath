import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const LABS_PROMPT = `You are the Polymath Labs Agent. 
Your goal is to create interactive, runnable HTML/JS experiments based on the current lesson.

UNIT: {{unitTitle}}
CONTENT: {{explanation}}

INSTRUCTIONS:
1. Create a SINGLE HTML file content (no external files) that demonstrates the concept.
2. Use vanilla JS and CSS. You can use CDNs for small libraries like D3, Chart.js, or Three.js if ABSOLUTELY necessary.
3. The UI should be dark-themed, sleek, and responsive.
4. It must be interactive: buttons, sliders, or canvas-based simulations.
5. Keep it high-fidelity but performant.

Return ONLY valid JSON:
{
  "title": "Short descriptive title",
  "description": "What this experiment demonstrates",
  "code": "<!DOCTYPE html>..." 
}
`;

export class LabsAgent implements Agent {
  id = "labs-agent";
  role = "labs" as any; // Future-proofing the role
  priority = 60;

  constructor(private readonly llm: LLMClient) { }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state } = input;
    const activeUnitId = state.activeStep?.unitId;
    if (!activeUnitId) return null;

    const teachingContent = state.knowledgeRepository?.[activeUnitId];
    if (!teachingContent) return null;

    // Check if we specifically want an experiment or if it's generally relevant
    const hasExperimentSense = teachingContent.senses.some(s => s.type === "experiment");
    if (!hasExperimentSense) return null;

    // Check if we already have it in state
    const existingExperiment = state.artifacts?.find(a => a.kind === "experiment" && (a as any).unitId === activeUnitId);
    if (existingExperiment) return null;

    const prompt = LABS_PROMPT
      .replace("{{unitTitle}}", teachingContent.title)
      .replace("{{explanation}}", teachingContent.explanation);

    try {
      const response = await this.llm.generate(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        statePatch: {
          artifacts: [
            ...(state.artifacts ?? []),
            {
              id: `exp-${activeUnitId}-${Date.now()}`,
              kind: "experiment",
              title: parsed.title,
              description: parsed.description,
              code: parsed.code,
              unitId: activeUnitId
            } as any
          ]
        },
        notes: [`Labs Agent generated experiment: ${parsed.title}`]
      };
    } catch (err) {
      console.error("LabsAgent failed:", err);
      return null;
    }
  }
}
