import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { EvidenceSignal } from "@polymath/core";
import type { Agent, AgentIntent, AgentUpdate, SharedUnderstandingState } from "./types";

type AgentGraphState = {
  shared: SharedUnderstandingState;
  newSignals: EvidenceSignal[];
  intents: AgentIntent[];
  notes: string[];
};

const AgentState = Annotation.Root({
  shared: Annotation<SharedUnderstandingState>({
    reducer: (_left, right) => right,
    default: () =>
      ({
        userId: "unknown",
        goal: {
          id: "goal-unknown",
          title: "Unknown",
          domains: [],
          desiredDepth: 1,
          createdAt: Date.now(),
        },
        thesis: null,
        valueVector: {
          curiosity: 0,
          depth: 0,
          practice: 0,
          revision: 0,
          collaboration: 0,
        },
        depthLevel: 1,
        knowledgeLevel: 0,
        recentActivities: [],
        recentSignals: [],
        pendingIntents: [],
        artifacts: [],
        lastUpdatedAt: Date.now(),
      }) as SharedUnderstandingState,
  }),
  newSignals: Annotation<EvidenceSignal[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  intents: Annotation<AgentIntent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  notes: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

function applyUpdate(
  state: SharedUnderstandingState,
  update: AgentUpdate,
  now: number
): SharedUnderstandingState {
  if (!update.statePatch) {
    return state;
  }
  return {
    ...state,
    ...update.statePatch,
    pendingIntents: [
      ...state.pendingIntents.filter(
        (pi) => !update.intents?.some((ni) => ni.type === pi.type) // Simple heuristic for consumption
      ),
      ...(update.intents ?? []),
    ],
    lastUpdatedAt: now,
  };
}

function makeAgentNode(agent: Agent) {
  return async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
    const update = await agent.observe({
      now: Date.now(),
      newSignals: state.newSignals,
      state: state.shared,
    });
    if (!update) {
      return {};
    }

    const nextShared = applyUpdate(state.shared, update, Date.now());
    return {
      shared: nextShared,
      intents: update.intents ?? [],
      notes: update.notes ?? [],
    };
  };
}

export class LangGraphAgentRuntime {
  private readonly graph;
  private readonly agents: Agent[];
  public shared: SharedUnderstandingState;

  constructor(params: { agents: Agent[]; initialState: SharedUnderstandingState }) {
    this.agents = params.agents;
    this.shared = params.initialState;

    let builder = new StateGraph(AgentState);

    // Add all nodes sequentially
    this.agents.forEach((agent) => {
      builder = builder.addNode(`agent-${agent.id}` as any, makeAgentNode(agent));
    });

    if (this.agents.length > 0) {
      builder = builder.addEdge(START, `agent-${this.agents[0].id}` as any);
      for (let i = 1; i < this.agents.length; i += 1) {
        builder = builder.addEdge(`agent-${this.agents[i - 1].id}` as any, `agent-${this.agents[i].id}` as any);
      }
      builder = builder.addEdge(`agent-${this.agents[this.agents.length - 1].id}` as any, END);
    }

    this.graph = builder.compile();
  }

  async ingest(signals: EvidenceSignal[]) {
    const now = Date.now();
    const shared = {
      ...this.shared,
      recentSignals: [...signals, ...this.shared.recentSignals].slice(0, 200),
      lastUpdatedAt: now,
    };
    const result = await this.graph.invoke({
      shared,
      newSignals: signals,
      intents: [],
      notes: [],
    });

    this.shared = result.shared;
    return {
      intents: result.intents,
      notes: result.notes,
      shared: result.shared,
    };
  }

  async *streamIngest(signals: EvidenceSignal[]) {
    const now = Date.now();
    const shared = {
      ...this.shared,
      recentSignals: [...signals, ...this.shared.recentSignals].slice(0, 200),
      lastUpdatedAt: now,
    };

    const stream = await this.graph.stream({
      shared,
      newSignals: signals,
      intents: [],
      notes: [],
    });

    for await (const update of stream) {
      // update is a dictionary where keys are node names and values are their outputs
      const entries = Object.entries(update);
      if (entries.length > 0) {
        const [nodeName, output] = entries[0] as [string, any];
        if (output.shared) {
          this.shared = output.shared;
          yield {
            node: nodeName,
            shared: this.shared,
            notes: output.notes ?? [],
            intents: output.intents ?? []
          };
        }
      }
    }
  }
}
