import type { ID, LearningGoal, LearningUnit } from "@polymath/core";
import type { SenseInput, SenseOutput, SenseType } from "@polymath/senses";

export interface SurfaceContext {
  userId: ID;
  goal: LearningGoal;
  unit?: LearningUnit;
}

export type SurfaceComponentKind =
  | "panel"
  | "canvas"
  | "timeline"
  | "notebook"
  | "workspace"
  | "quiz"
  | "poll"
  | "memory"
  | "collab";

export interface SurfaceNode {
  id: ID;
  kind: SurfaceComponentKind;
  title?: string;
  props?: Record<string, unknown>;
  senses?: SenseType[];
  children?: SurfaceNode[];
}

export interface LearningSurface {
  id: ID;
  title: string;
  layout: SurfaceNode;
}

export interface UIBuilder {
  buildSurface(context: SurfaceContext): Promise<LearningSurface>;
  mountSurface(surface: LearningSurface, containerId: string): Promise<void>;
  runSense(input: SenseInput): Promise<SenseOutput>;
}
