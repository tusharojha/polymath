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
  MermaidFixAgent,
  UIBuilderAgent,
} from "@polymath/agents";
import { BrainMemory } from "./memory";
import { runResearch } from "./research";
import { runSenses } from "@polymath/senses";
import { runExperimentSense } from "@polymath/senses";

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
        new RevisionDepthAgent(),
        new SynthesisAgent(),
        new TeachingAgent(llm),
        new InterjectionAgent(llm),
        new MermaidFixAgent(llm),
        new UIBuilderAgent(llm),
      ],
      initialState: store.get(),
    });
  }

  private onStatusChange?: ((status: "thinking" | "idle") => void) | null;
  private onUpdateListener?: ((state: any) => void) | null;

  async ingest(signals: EvidenceSignal[]): Promise<BrainSessionResult> {
    if (!this.runtime) {
      throw new Error("Brain runtime not initialized.");
    }

    this.onStatusChange?.("thinking");

    try {
      const loadExperimentRequests: Array<{ prompt?: string; params?: Record<string, unknown> }> = [];
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
          if (action === "load-experiment") {
            loadExperimentRequests.push({ prompt: data?.prompt, params: data?.params });
          }
        }
        return signal;
      });

      if (loadExperimentRequests.length > 0 && this.llm) {
        const outputs = [];
        for (const req of loadExperimentRequests) {
          const output = await runExperimentSense(
            {
              context: { goal: { id: this.goalId }, userId: this.userId },
              prompt: req.prompt,
              params: req.params,
            } as any,
            this.llm as any
          );
          outputs.push(output);
        }
        const senseSignals = outputs.map((out: any) => ({
          id: `signal-${out.id || Date.now()}`,
          userId: this.userId,
          goalId: this.goalId,
          observedAt: Date.now(),
          type: "direct" as const,
          payload: { kind: "sense-output", output: out },
        }));
        const combinedSignals = [...mappedSignals, ...senseSignals];

        let lastResult: any = null;
        for await (const partial of this.runtime.streamIngest(combinedSignals)) {
          lastResult = partial;
          this.onUpdateListener?.(partial.shared);
        }

        await this.memory.saveState(this.userId, this.goalId, lastResult.shared);
        return {
          shared: lastResult.shared,
          intents: lastResult.intents,
          notes: lastResult.notes,
        };
      }

      let lastResult: any = null;
      for await (const partial of this.runtime.streamIngest(mappedSignals)) {
        lastResult = partial;
        this.onUpdateListener?.(partial.shared);
      }

      // Pass 2: If we have sense intents, run them
      const senseIntents = lastResult.intents.filter((i: any) => i.type === "present-sense");
      if (senseIntents.length > 0) {
        const senseOutputs = await runSenses(senseIntents, lastResult.shared, this.llm);

        const newSignals = senseOutputs.map((out: any) => ({
          id: `signal-${out.id}`,
          userId: this.userId,
          goalId: this.goalId,
          observedAt: Date.now(),
          type: "direct" as const,
          payload: { kind: "sense-output", output: out },
        }));

        for await (const partial of this.runtime.streamIngest(newSignals)) {
          lastResult = partial;
          this.onUpdateListener?.(partial.shared);
        }
      }

      await this.memory.saveState(this.userId, this.goalId, lastResult.shared);
      return {
        shared: lastResult.shared,
        intents: lastResult.intents,
        notes: lastResult.notes,
      };
    } finally {
      this.onStatusChange?.("idle");
    }
  }

  setStatusListener(listener: (status: "thinking" | "idle") => void) {
    this.onStatusChange = listener;
  }

  onUpdate(listener: (state: any) => void) {
    this.onUpdateListener = listener;
  }
}
