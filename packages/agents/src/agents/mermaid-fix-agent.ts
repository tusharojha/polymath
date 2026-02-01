import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const FIX_PROMPT = `You are a Mermaid.js syntax repair assistant.
Fix the Mermaid diagram so it parses successfully.
Rules:
- Return ONLY valid Mermaid code (no backticks).
- Preserve the intended meaning.
- Use simple node labels; avoid parentheses or special characters if they cause errors.

BROKEN MERMAID:
{{code}}
`;

export class MermaidFixAgent implements Agent {
  id = "mermaid-fix-agent";
  role = "teaching" as const;
  priority = 80;

  constructor(private readonly llm: LLMClient) {}

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const fixSignal = input.newSignals.find(
      (s) => s.payload?.kind === "ui-intent" && s.payload?.action === "fix-mermaid"
    );
    if (!fixSignal) return null;

    const data = fixSignal.payload?.data as any;
    const code = (data?.code || "").toString();
    const unitId = data?.unitId as string | undefined;
    const mediaIndex = data?.mediaIndex as number | undefined;

    if (!code || !unitId || typeof mediaIndex !== "number") return null;

    try {
      const response = await this.llm.generate(
        FIX_PROMPT.replace("{{code}}", code)
      );
      const fixed = response.trim();

      const existing = input.state.knowledgeRepository?.[unitId];
      if (!existing) return null;

      const media = Array.isArray(existing.media) ? [...existing.media] : [];
      if (!media[mediaIndex]) return null;

      media[mediaIndex] = {
        ...media[mediaIndex],
        kind: "mermaid",
        content: fixed
      };

      return {
        statePatch: {
          knowledgeRepository: {
            ...input.state.knowledgeRepository,
            [unitId]: {
              ...existing,
              media
            }
          }
        },
        notes: ["Mermaid diagram repaired and updated."]
      };
    } catch (err) {
      console.error("MermaidFixAgent failed:", err);
      return null;
    }
  }
}
