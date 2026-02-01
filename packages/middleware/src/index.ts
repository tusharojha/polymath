import type {
  EvidenceSignal,
  LearningActivity,
  LearningGoal,
  ProgressSnapshot,
  UnderstandingThesis,
} from "@polymath/core";

export interface SignalEnvelope {
  goal: LearningGoal;
  activity?: LearningActivity;
  signals: EvidenceSignal[];
}

export interface ThesisUpdate {
  thesis: UnderstandingThesis;
  confidenceDelta?: number;
  reasons?: string[];
}

export interface LearningStepPlan {
  id: string;
  title: string;
  rationale: string;
  nextActivities: Array<{
    kind: string;
    senseIds: string[];
    prompt?: string;
  }>;
}

export interface UnderstandingMiddleware {
  ingest(envelope: SignalEnvelope): Promise<ThesisUpdate>;
  snapshot(goalId: string, userId: string): Promise<ProgressSnapshot>;
  planNextSteps(goalId: string, userId: string): Promise<LearningStepPlan>;
}
