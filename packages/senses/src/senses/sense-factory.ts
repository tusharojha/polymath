import type { SenseController, SenseInput, SenseOutput, SensePlugin } from "../index";
import { buildSenseOutput, type SenseTemplateConfig } from "./base";

class TemplateSenseController implements SenseController {
  id: string;
  type: SensePlugin["type"];
  private readonly config: SenseTemplateConfig;

  constructor(config: SenseTemplateConfig) {
    this.id = config.id;
    this.type = config.type;
    this.config = config;
  }

  async prepare(_input: SenseInput): Promise<void> {
    return;
  }

  async present(input: SenseInput): Promise<SenseOutput> {
    return buildSenseOutput(input, this.config);
  }

  async dispose(): Promise<void> {
    return;
  }
}

export function createTemplateSense(config: SenseTemplateConfig): SensePlugin {
  return {
    id: config.id,
    name: config.name,
    version: "0.1.0",
    type: config.type,
    create() {
      return new TemplateSenseController(config);
    },
  };
}
