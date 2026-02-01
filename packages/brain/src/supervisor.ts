import type { EvidenceSignal } from "@polymath/core";
import type { BrainSessionResult } from "./runtime";
import { BrainRuntime } from "./runtime";

export interface UIDirective {
  type: "questionnaire" | "curriculum" | "learning";
  payload?: Record<string, unknown>;
}

export interface SupervisorUpdate extends BrainSessionResult {
  ui: UIDirective;
}

export class BrainSupervisor {
  private readonly runtime: BrainRuntime;

  constructor(runtime: BrainRuntime) {
    this.runtime = runtime;
  }

  private deriveUI(update: BrainSessionResult): UIDirective {
    if (update.shared.phase === "questionnaire" && update.shared.questions) {
      return { type: "questionnaire", payload: { questions: update.shared.questions } };
    }
    if (update.shared.curriculum) {
      return { type: "curriculum", payload: { curriculum: update.shared.curriculum } };
    }
    return { type: "learning", payload: { step: update.shared.activeStep } };
  }

  async start(signal: EvidenceSignal): Promise<SupervisorUpdate> {
    const result = await this.runtime.ingest([signal]);
    return { ...result, ui: this.deriveUI(result) };
  }

  async signal(signal: EvidenceSignal): Promise<SupervisorUpdate> {
    const result = await this.runtime.ingest([signal]);
    return { ...result, ui: this.deriveUI(result) };
  }
}
