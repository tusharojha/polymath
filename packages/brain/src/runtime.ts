import type { EvidenceSignal } from "@polymath/core";
import {
  InMemoryUnderstandingState,
  LangGraphAgentRuntime,
  OpenAIResponsesClient,
  NullLLMClient,
  PlannerAgent,
  CurriculumAgent,
  UnderstandingAgent,
  QuestionAgent,
  SenseOrchestratorAgent,
  LearningStepBuilderAgent,
  RevisionDepthAgent,
  SynthesisAgent,
  TeachingAgent,
  UIBuilderAgent,
} from "@polymath/agents";
import { BrainMemory } from "./memory";
import { runResearch } from "./research";
import { runSenses } from "@polymath/senses";

export interface BrainSessionResult {
  shared: ReturnType<InMemoryUnderstandingState["get"]>;
  intents: Array<{ type: string }>;
  notes: string[];
}

export class BrainRuntime {
  private runtime: LangGraphAgentRuntime | null = null;
  private readonly userId: string;
  private readonly goalId: string;
  private memory: BrainMemory;

  constructor(params: {
    userId: string;
    goalId: string;
    topic: string;
    apiKey?: string;
    dbPath: string;
  }) {
    this.userId = params.userId;
    this.goalId = params.goalId;
    this.memory = new BrainMemory(params.dbPath);
    const now = Date.now();
    const store = new InMemoryUnderstandingState({
      userId: params.userId,
      goal: {
        id: params.goalId,
        title: params.topic,
        domains: [params.topic],
        desiredDepth: 3,
        createdAt: now,
      },
      initialVector: {
        curiosity: 0.7,
        depth: 0.4,
        practice: 0.3,
        revision: 0.2,
        collaboration: 0.2,
      },
      depthLevel: 2,
      now,
    });
    this.memory
      .loadState(params.userId, params.goalId)
      .then((persisted) => {
        if (persisted) {
          store.applyPatch(persisted);
        }
      })
      .catch(() => undefined);

    const llm = params.apiKey
      ? new OpenAIResponsesClient({ apiKey: params.apiKey })
      : new NullLLMClient();

    this.runtime = new LangGraphAgentRuntime({
      agents: [
        new UnderstandingAgent(),
        new PlannerAgent(llm),
        new QuestionAgent(llm),
        new CurriculumAgent(llm, runResearch),
        new SenseOrchestratorAgent(),
        new LearningStepBuilderAgent(llm),
        new RevisionDepthAgent(),
        new SynthesisAgent(),
        new TeachingAgent(llm),
        new UIBuilderAgent(llm),
      ],
      initialState: store.get(),
    });
  }

  private onStatusChange?: ((status: "thinking" | "idle") => void) | null;

  async ingest(signals: EvidenceSignal[]): Promise<BrainSessionResult> {
    if (!this.runtime) {
      throw new Error("Brain runtime not initialized.");
    }

    this.onStatusChange?.("thinking");

    try {
      console.log('signals', signals)
      let result = await this.runtime.ingest(signals);

      // Pass 2: If we have sense intents, run them and re-ingest their outputs
      const senseIntents = result.intents.filter((i: any) => i.type === "present-sense");
      console.log('senseIntents', senseIntents)
      if (senseIntents.length > 0) {
        const senseOutputs = await runSenses(senseIntents, result.shared);

        const newSignals = senseOutputs.map((out: any) => ({
          id: `signal-${out.id}`,
          userId: this.userId,
          goalId: this.goalId,
          observedAt: Date.now(),
          type: "direct" as const,
          payload: { kind: "sense-output", output: out },
        }));

        // Secondary pass to let UI-Builder react to these senses
        result = await this.runtime.ingest(newSignals);
      }

      await this.memory.saveState(this.userId, this.goalId, result.shared);
      return {
        shared: result.shared,
        intents: result.intents,
        notes: result.notes,
      };
    } finally {
      this.onStatusChange?.("idle");
    }
  }

  setStatusListener(listener: (status: "thinking" | "idle") => void) {
    this.onStatusChange = listener;
  }
}
