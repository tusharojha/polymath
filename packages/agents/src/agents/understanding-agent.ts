import type { EvidenceSignal } from "@polymath/core";
import type { Agent, AgentInput, AgentUpdate } from "../types";

function extractConcept(signal: EvidenceSignal, fallback: string) {
  const concept =
    (signal.payload?.["concept"] as string | undefined) ??
    (signal.payload?.["topic"] as string | undefined);
  return concept || fallback;
}

export class UnderstandingAgent implements Agent {
  id = "understanding-agent";
  role = "understanding" as const;
  priority = 100;

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    if (input.newSignals.length === 0) {
      return null;
    }
    const now = input.now;
    const baseGraph = input.state.thesisGraph ?? {
      id: `thesis-${input.state.goal.id}`,
      nodes: [],
      edges: [],
    };
    const nodes = [...baseGraph.nodes];
    const edges = [...baseGraph.edges];
    const goalConceptId = `concept-${input.state.goal.id}`;
    if (!nodes.find((node) => node.id === goalConceptId)) {
      nodes.push({
        id: goalConceptId,
        label: input.state.goal.title,
        confidence: 0.2,
        decayRate: 0.02,
        lastInteractionAt: now,
      });
    }

    for (const signal of input.newSignals) {
      const kind = signal.payload?.["kind"] as string | undefined;
      if (kind === "ui-intent" && signal.payload?.["action"] === "submit-answers") {
        const data = signal.payload?.["data"] as any;
        const answers = data?.answers || data?.formState || (signal.payload as any)?.answers;
        if (answers) {
          // Record the answers and update purpose if found
          // Stop force-switching phase to "curriculum" here.
          // Let the Planner decide if we have enough info.
          return {
            statePatch: {
              answers,
              userPurpose: answers?.["q3"] ?? input.state.userPurpose,
            },
          };
        }
      }
      const concept = extractConcept(signal, input.state.goal.title);
      const nodeId = `concept-${concept.toLowerCase().replace(/\s+/g, "-")}`;
      let node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        node = {
          id: nodeId,
          label: concept,
          confidence: 0.2,
          decayRate: 0.02,
          lastInteractionAt: now,
        };
        nodes.push(node);
        edges.push({
          from: goalConceptId,
          to: nodeId,
          relation: "includes",
        });
      }

      if (kind === "answers") {
        const answers = signal.payload?.["answers"] as Record<string, string>;
        const confidenceRaw = answers?.["q4"];
        const confidenceScore = confidenceRaw ? Number(confidenceRaw) : NaN;
        const knowledgeLevel = Number.isFinite(confidenceScore)
          ? Math.max(0, Math.min(5, Math.round(confidenceScore / 2)))
          : input.state.knowledgeLevel;
        return {
          statePatch: {
            answers,
            userPurpose: answers?.["q3"] ?? input.state.userPurpose,
            knowledgeLevel: knowledgeLevel as any,
            phase: "curriculum",
          },
        };
      }
      if (kind === "quiz") {
        const correct = Boolean(signal.payload?.["correct"]);
        node.confidence = Math.max(
          0,
          Math.min(1, node.confidence + (correct ? 0.15 : -0.2))
        );
      } else if (kind === "time-spent") {
        const seconds = Number(signal.payload?.["seconds"] ?? 0);
        if (seconds > 60) {
          node.confidence = Math.max(0, Math.min(1, node.confidence - 0.05));
        } else {
          node.confidence = Math.max(0, Math.min(1, node.confidence + 0.02));
        }
      } else if (kind === "revisit") {
        node.confidence = Math.max(0, Math.min(1, node.confidence + 0.05));
      }

      node.lastInteractionAt = now;
    }

    const avgConfidence =
      nodes.reduce((acc, node) => acc + node.confidence, 0) / Math.max(1, nodes.length);
    const prior = input.state.thesis;
    const confidence = prior ? Math.min(1, avgConfidence) : Math.min(1, avgConfidence);
    const summary =
      prior?.summary ??
      `Understanding graph updated for ${nodes.length} concepts.`;

    return {
      statePatch: {
        thesis: {
          id: prior?.id ?? "thesis-0",
          userId: input.state.userId,
          goalId: input.state.goal.id,
          createdAt: prior?.createdAt ?? input.now,
          summary,
          confidence,
          claims: prior?.claims ?? [],
          gaps: prior?.gaps ?? ["Identify missing mental models"],
          evidence: [],
        },
        thesisGraph: {
          id: baseGraph.id,
          nodes,
          edges,
        },
        knowledgeLevel: prior ? input.state.knowledgeLevel : 1,
      },
      notes: ["Updated probabilistic thesis from recent signals."],
    };
  }
}
