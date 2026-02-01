import { z } from "zod";

export const ThesisNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  confidence: z.number().min(0).max(1),
  decayRate: z.number().min(0).max(1),
  preferredSense: z.string().optional(),
  lastInteractionAt: z.number(),
});

export const ThesisEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: z.string(),
});

export const UnderstandingThesisSchema = z.object({
  id: z.string(),
  userId: z.string(),
  goalId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  nodes: z.array(ThesisNodeSchema),
  edges: z.array(ThesisEdgeSchema),
});

export type ThesisNode = z.infer<typeof ThesisNodeSchema>;
export type ThesisEdge = z.infer<typeof ThesisEdgeSchema>;
export type UnderstandingThesisGraph = z.infer<typeof UnderstandingThesisSchema>;
