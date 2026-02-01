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
  InterjectionAgent,
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
  private llm: { generate: (p: string) => Promise<string> };

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
    this.llm = llm;

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
        new InterjectionAgent(llm),
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
      const mappedSignals = signals.map((signal: any) => {
        if (signal.payload?.kind === "ui-intent") {
          const { action, data } = signal.payload as any;
          if (action === "submit-intake" || action === "submit-answers") {
            return {
              ...signal,
              payload: { kind: "answers", answers: data.answers },
            };
          }
          if (action === "amend-curriculum") {
            return {
              ...signal,
              payload: { kind: "amend-curriculum", request: data?.request ?? "" },
            };
          }
        }
        return signal;
      });
      let result = await this.runtime.ingest(mappedSignals);

      // Pass 2: If we have sense intents, run them and re-ingest their outputs
      const senseIntents = result.intents.filter((i: any) => i.type === "present-sense");
      if (senseIntents.length > 0) {
        const senseOutputs = await runSenses(senseIntents, result.shared, this.llm);

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
