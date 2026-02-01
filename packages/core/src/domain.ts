// Core domain model for Polymath.
// These are intentionally UI-agnostic and support multiple learning styles.

export type ID = string;
export type TimestampMs = number;

export type Score01 = number; // 0..1 inclusive

export type PolymathValueKey =
  | "curiosity"
  | "depth"
  | "practice"
  | "revision"
  | "collaboration";

export type PolymathValueVector = Record<PolymathValueKey, Score01>;

export type DepthLevel = 1 | 2 | 3 | 4 | 5;

export type LoopStage =
  | "explore"
  | "deepen"
  | "apply"
  | "revise"
  | "collaborate";

export interface UserProfile {
  id: ID;
  displayName: string;
  createdAt: TimestampMs;
  timezone?: string;
  interests: string[];
  activeGoals: ID[];
  valueBaseline?: PolymathValueVector;
}

export interface LearningGoal {
  id: ID;
  title: string;
  description?: string;
  domains: string[];
  desiredDepth: DepthLevel;
  targetValueWeights?: Partial<Record<PolymathValueKey, number>>;
  createdAt: TimestampMs;
}

export interface LearningCycle {
  id: ID;
  userId: ID;
  goalId: ID;
  stage: LoopStage;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
}

export type ContentKind =
  | "paper"
  | "course"
  | "article"
  | "video"
  | "podcast"
  | "interactive"
  | "dataset"
  | "tool"
  | "prompt"
  | "project";

export interface LearningUnit {
  id: ID;
  title: string;
  kind: ContentKind;
  source?: string;
  domains: string[];
  summary?: string;
  createdAt: TimestampMs;
}

export type ActivityKind =
  | "read"
  | "watch"
  | "listen"
  | "summarize"
  | "experiment"
  | "build"
  | "teach"
  | "review"
  | "discuss"
  | "test";

export interface LearningActivity {
  id: ID;
  userId: ID;
  goalId: ID;
  unitId?: ID;
  kind: ActivityKind;
  stage: LoopStage;
  startedAt: TimestampMs;
  endedAt?: TimestampMs;
  notes?: string;
  tags?: string[];
}

export type SignalType = "direct" | "indirect";

export interface EvidenceSignal {
  id: ID;
  userId: ID;
  goalId: ID;
  activityId?: ID;
  type: SignalType;
  observedAt: TimestampMs;
  payload: Record<string, unknown>;
}

export interface UnderstandingThesis {
  id: ID;
  userId: ID;
  goalId: ID;
  createdAt: TimestampMs;
  summary: string;
  confidence: Score01;
  claims: string[];
  gaps: string[];
  evidence: ID[];
}

export type ArtifactKind =
  | "note"
  | "mindmap"
  | "model"
  | "prototype"
  | "lesson"
  | "report"
  | "insight";

export interface KnowledgeArtifact {
  id: ID;
  userId: ID;
  goalId: ID;
  createdAt: TimestampMs;
  kind: ArtifactKind;
  title: string;
  summary?: string;
  links?: string[];
}

export interface ValueDelta {
  value: PolymathValueKey;
  delta: number;
  reason?: string;
}

export interface ProgressSnapshot {
  id: ID;
  userId: ID;
  goalId: ID;
  capturedAt: TimestampMs;
  valueVector: PolymathValueVector;
  deltas?: ValueDelta[];
  depthLevel?: DepthLevel;
}

export type KnowledgeLevel = number;

export interface CurriculumUnit {
  id: ID;
  title: string;
  objective: string;
  firstPrinciples: string[];
  checkpoints: string[];
}

export interface CurriculumModule {
  id: ID;
  title: string;
  rationale: string;
  units: CurriculumUnit[];
}

export interface CurriculumPlan {
  id: ID;
  goalId: ID;
  createdAt: TimestampMs;
  summary: string;
  story?: string;
  modules: CurriculumModule[];
  tree?: CurriculumTreeNode;
}

export interface CurriculumTreeNode {
  id: ID;
  title: string;
  goal: string;
  keyLearnings: string[];
  children?: CurriculumTreeNode[];
}

export interface LearningStep {
  id: ID;
  goalId: ID;
  title: string;
  rationale: string;
  senses: string[];
  prompts: string[];
  unitId?: ID;
  layout?: LayoutSchema;
}

export type LayoutNodeType =
  | "hero"
  | "section"
  | "card"
  | "list"
  | "grid"
  | "prompt"
  | "callout"
  | "header"
  | "text"
  | "hstack"
  | "vstack"
  | "button";

export interface LayoutNode {
  id: ID;
  type?: LayoutNodeType;
  kind?: string;
  title?: string;
  content?: string;
  items?: string[];
  props?: Record<string, any>;
  children?: LayoutNode[];
}

export interface LayoutSchema {
  id: ID;
  title: string;
  nodes: LayoutNode[];
}
