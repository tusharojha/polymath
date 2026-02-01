import type {
  DepthLevel,
  EvidenceSignal,
  ID,
  KnowledgeLevel,
  LayoutSchema,
  LearningStep,
  LearningActivity,
  LearningGoal,
  PolymathValueVector,
  ProgressSnapshot,
  CurriculumPlan,
  UnderstandingThesis,
} from "@polymath/core";
import type { SenseType } from "@polymath/senses";

export type AgentRole =
  | "understanding"
  | "planner"
  | "curriculum"
  | "sense-orchestrator"
  | "learning-step-builder"
  | "revision-depth"
  | "synthesis"
  | "teaching"
  | "ui-builder";

export interface TeachingContent {
  unitId: ID;
  title: string;
  explanation: string;
  firstPrinciples: string[];
  senses: Array<{
    type: SenseType;
    prompt: string;
    reasoning: string;
  }>;
  interjections: Array<{
    question: string;
    answer: string;
    motivation: string;
  }>;
}

export interface SharedUnderstandingState {
  userId: ID;
  goal: LearningGoal;
  thesis: UnderstandingThesis | null;
  thesisGraph?: {
    id: ID;
    nodes: Array<{
      id: ID;
      label: string;
      confidence: number;
      decayRate: number;
      preferredSense?: string;
      lastInteractionAt: number;
    }>;
    edges: Array<{
      from: ID;
      to: ID;
      relation: string;
    }>;
  };
  valueVector: PolymathValueVector;
  depthLevel: DepthLevel;
  knowledgeLevel: KnowledgeLevel;
  phase?: "intake" | "questionnaire" | "curriculum" | "learning";
  userPurpose?: string;
  questions?: Array<{
    id: ID;
    prompt: string;
    kind?: "text" | "choice";
    choices?: string[];
  }>;
  answers?: Record<ID, string>;
  curriculum?: CurriculumPlan;
  curriculumProgress?: Record<ID, "not_started" | "in_progress" | "done">;
  knowledgeRepository?: Record<ID, TeachingContent>; // Persisted explanations
  activeStep?: LearningStep;
  pendingUnitId?: ID | null;
  learningSurface?: {
    layout: {
      id: ID;
      kind: string;
      props?: Record<string, unknown>;
      title?: string;
      content?: string;
      children?: unknown[];
    };
  };
  latestSnapshot?: ProgressSnapshot;
  recentActivities: LearningActivity[];
  recentSignals: EvidenceSignal[];
  pendingIntents: AgentIntent[];
  artifacts: Array<{
    id: ID;
    kind: string;
    title: string;
  }>;
  lastUpdatedAt: number;
}

export interface AgentInput {
  now: number;
  newSignals: EvidenceSignal[];
  state: SharedUnderstandingState;
}

export interface AgentUpdate {
  statePatch?: Partial<SharedUnderstandingState>;
  intents?: AgentIntent[];
  notes?: string[];
}

export interface Agent {
  id: ID;
  role: AgentRole;
  priority: number;
  observe(input: AgentInput): Promise<AgentUpdate | null>;
}

export type AgentIntent =
  | {
    type: "draft-curriculum";
    topic: string;
    knowledgeLevel: KnowledgeLevel;
  }
  | {
    type: "ask-questions";
    topic: string;
  }
  | {
    type: "begin-teaching";
    moduleId?: ID;
    unitId?: ID;
  }
  | {
    type: "present-sense";
    sense: SenseType;
    prompt?: string;
    params?: Record<string, unknown>;
  }
  | {
    type: "build-step";
    title: string;
    layoutHint?: string;
    senses?: SenseType[];
    layout?: LayoutSchema;
  }
  | {
    type: "schedule-revision";
    concept: string;
    dueAt: number;
    reason?: string;
  }
  | {
    type: "request-output";
    artifactType: string;
    prompt: string;
  }
  | {
    type: "deepen-topic";
    topic: string;
    depthTarget?: DepthLevel;
  }
  | {
    type: "apply-practice";
    prompt: string;
    mode?: "experiment" | "project" | "simulation";
  };
