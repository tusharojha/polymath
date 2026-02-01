import type {
  EvidenceSignal,
  ID,
  LearningGoal,
  PolymathValueVector,
} from "@polymath/core";
import type { AgentIntent, SharedUnderstandingState } from "./types";

function mergeState(
  state: SharedUnderstandingState,
  patch: Partial<SharedUnderstandingState>
) {
  return {
    ...state,
    ...patch,
    pendingIntents:
      patch.pendingIntents ?? state.pendingIntents,
  };
}

export class InMemoryUnderstandingState {
  private state: SharedUnderstandingState;

  constructor(params: {
    userId: ID;
    goal: LearningGoal;
    initialVector: PolymathValueVector;
    depthLevel: SharedUnderstandingState["depthLevel"];
    now: number;
  }) {
    this.state = {
      userId: params.userId,
      goal: params.goal,
      thesis: null,
      thesisGraph: undefined,
      valueVector: params.initialVector,
      depthLevel: params.depthLevel,
      knowledgeLevel: 0,
      recentActivities: [],
      recentSignals: [],
      pendingIntents: [],
      artifacts: [],
      lastUpdatedAt: params.now,
    };
  }

  get() {
    return this.state;
  }

  applySignals(signals: EvidenceSignal[], now: number) {
    if (signals.length === 0) {
      return;
    }
    this.state = {
      ...this.state,
      recentSignals: [...signals, ...this.state.recentSignals].slice(0, 200),
      lastUpdatedAt: now,
    };
  }

  applyIntents(intents: AgentIntent[]) {
    if (intents.length === 0) {
      return;
    }
    this.state = {
      ...this.state,
      pendingIntents: [...this.state.pendingIntents, ...intents],
    };
  }

  applyPatch(patch: Partial<SharedUnderstandingState>) {
    this.state = mergeState(this.state, patch);
  }
}
