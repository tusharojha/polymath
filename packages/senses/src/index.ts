import type { ID, LearningGoal, LearningUnit } from "@polymath/core";

export type SenseType =
  | "sound"
  | "infographic"
  | "animation"
  | "slides"
  | "visual"
  | "character"
  | "music"
  | "experiment"
  | "paper"
  | "industry-update"
  | "custom";

export interface SenseContext {
  goal: LearningGoal;
  unit?: LearningUnit;
  userId: ID;
  locale?: string;
}

export interface SenseInput {
  context: SenseContext;
  prompt?: string;
  params?: Record<string, unknown>;
}

export interface SenseOutput {
  surfaceId?: ID;
  signals: Record<string, unknown>[];
  artifacts?: Record<string, unknown>[];
}

export interface SenseController {
  id: ID;
  type: SenseType;
  prepare(input: SenseInput): Promise<void>;
  present(input: SenseInput): Promise<SenseOutput>;
  dispose(): Promise<void>;
}

export interface SensePlugin {
  id: ID;
  name: string;
  version: string;
  type: SenseType;
  create(): SenseController;
}

export { defaultSensePlugins } from "./senses/default-senses";

export class SenseRegistry {
  private readonly plugins = new Map<ID, SensePlugin>();

  register(plugin: SensePlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: ID) {
    return this.plugins.get(id);
  }

  list() {
    return Array.from(this.plugins.values());
  }
}

export function createDefaultSenseRegistry(plugins: SensePlugin[]) {
  const registry = new SenseRegistry();
  for (const plugin of plugins) {
    registry.register(plugin);
  }
  return registry;
}
export * from "./senses/rich-senses";
