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
  private shared: SharedUnderstandingState;

  constructor(params: { agents: Agent[]; initialState: SharedUnderstandingState }) {
    this.agents = params.agents;
    this.shared = params.initialState;

    let builder = new StateGraph(AgentState);
    const nodeIds = this.agents.map((agent, index) => `agent-${index}-${agent.id}`);
    nodeIds.forEach((nodeId, index) => {
      builder = builder.addNode(nodeId as any, makeAgentNode(this.agents[index]));
    });

    if (nodeIds.length > 0) {
      builder = builder.addEdge(START, nodeIds[0] as any);
      for (let i = 1; i < nodeIds.length; i += 1) {
        builder = builder.addEdge(nodeIds[i - 1] as any, nodeIds[i] as any);
      }
      builder = builder.addEdge(nodeIds[nodeIds.length - 1] as any, END);
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
}
