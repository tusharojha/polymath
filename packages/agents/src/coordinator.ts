import type { EvidenceSignal } from "@polymath/core";
import type { Agent, AgentInput, AgentIntent, AgentUpdate } from "./types";
import { InMemoryUnderstandingState } from "./state";

export interface CoordinatorResult {
  intents: AgentIntent[];
  updates: AgentUpdate[];
}

export class AgentCoordinator {
  private readonly agents: Agent[] = [];

  constructor(private readonly store: InMemoryUnderstandingState) {}

  register(agent: Agent) {
    this.agents.push(agent);
    this.agents.sort((a, b) => a.priority - b.priority);
  }

  async ingest(signals: EvidenceSignal[], now = Date.now()): Promise<CoordinatorResult> {
    this.store.applySignals(signals, now);
    const updates: AgentUpdate[] = [];
    const intents: AgentIntent[] = [];

    for (const agent of this.agents) {
      const input: AgentInput = {
        now,
        newSignals: signals,
        state: this.store.get(),
      };
      const update = await agent.observe(input);
      if (!update) {
        continue;
      }
      updates.push(update);
      if (update.statePatch) {
        this.store.applyPatch({
          ...update.statePatch,
          lastUpdatedAt: now,
        });
      }
      if (update.intents?.length) {
        intents.push(...update.intents);
        this.store.applyIntents(update.intents);
      }
    }

    return { intents, updates };
  }
}
