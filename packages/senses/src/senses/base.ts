import type { SenseInput, SenseOutput, SenseType } from "../index";

export interface SenseTemplateConfig {
  id: string;
  name: string;
  type: SenseType;
  description: string;
}

export function buildSenseOutput(
  input: SenseInput,
  config: SenseTemplateConfig
): SenseOutput {
  return {
    signals: [
      {
        kind: "sense-presented",
        senseType: config.type,
        senseId: config.id,
        goalId: input.context.goal.id,
        timestamp: Date.now(),
      },
    ],
    artifacts: [
      {
        kind: config.type,
        title: config.name,
        description: config.description,
        prompt: input.prompt ?? null,
        params: input.params ?? null,
      },
    ],
  };
}
