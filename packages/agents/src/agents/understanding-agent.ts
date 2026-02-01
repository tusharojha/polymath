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

    const valueVector = { ...(input.state.valueVector || { curiosity: 0.5, depth: 0.5, practice: 0.5, revision: 0.5, collaboration: 0.5 }) };

    let currentAnswers = { ...input.state.answers };
    let unitStates = { ...input.state.unitStates };
    let userPurpose = input.state.userPurpose;
    let knowledgeLevel = input.state.knowledgeLevel;

    for (const signal of input.newSignals) {
      const kind = signal.payload?.["kind"] as string | undefined;
      const payload = signal.payload as any;

      // 1. Handle UI Intents & Answers (Direct Signals)
      const isSubmitAction = payload?.action === "submit-answers" || payload?.action === "sdui-interaction";
      const hasFormState = !!(payload?.data?.answers || payload?.data?.formState || payload?.answers);

      if (kind === "ui-intent" && isSubmitAction && hasFormState) {
        const data = payload?.data as any;
        const answers = data?.answers || data?.formState || payload?.answers;
        if (answers) {
          currentAnswers = { ...currentAnswers, ...answers };
          userPurpose = answers?.["q3"] ?? userPurpose;
          // Boost confidence of root node when answers are submitted
          nodes.forEach(n => {
            if (n.id === goalConceptId) n.confidence = Math.min(1, n.confidence + 0.3);
          });
        }
      }

      // Handle unit-specific state preservation
      const unitState = payload?.data?.unitState || payload?.unitState;
      const unitId = payload?.data?.unitId || payload?.unitId || input.state.activeStep?.unitId;
      if (unitState && unitId) {
        unitStates = { ...unitStates, [unitId]: unitState };
      }

      if (kind === "answers") {
        const answers = payload?.answers as Record<string, string>;
        currentAnswers = { ...currentAnswers, ...answers };
        userPurpose = answers?.["q3"] ?? userPurpose;
        const confidenceRaw = answers?.["q4"];
        const confidenceScore = confidenceRaw ? Number(confidenceRaw) : NaN;
        knowledgeLevel = Number.isFinite(confidenceScore)
          ? Math.max(0, Math.min(5, Math.round(confidenceScore / 2)))
          : knowledgeLevel;

        nodes.forEach(n => {
          if (n.id === goalConceptId) n.confidence = Math.min(1, n.confidence + 0.4);
        });
      }

      // 2. Extract Concept & Update Confidence (Indirect/Behavioral Signals)
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

      if (kind === "quiz") {
        const correct = Boolean(payload?.correct);
        node.confidence = Math.max(0, Math.min(1, node.confidence + (correct ? 0.15 : -0.2)));
        valueVector.practice = Math.min(1, valueVector.practice + 0.05);
        valueVector.depth = Math.min(1, valueVector.depth + (correct ? 0.02 : -0.01));
      } else if (kind === "time-spent") {
        const seconds = Number(payload?.seconds ?? 0);
        if (seconds > 60) {
          node.confidence = Math.max(0, Math.min(1, node.confidence - 0.05));
          valueVector.depth = Math.min(1, valueVector.depth + 0.03);
        } else {
          node.confidence = Math.max(0, Math.min(1, node.confidence + 0.02));
          valueVector.curiosity = Math.min(1, valueVector.curiosity + 0.01);
        }
      } else if (kind === "revisit") {
        node.confidence = Math.max(0, Math.min(1, node.confidence + 0.05));
        valueVector.revision = Math.min(1, valueVector.revision + 0.05);
      }

      node.lastInteractionAt = now;
    }

    const avgConfidence =
      nodes.reduce((acc, node) => acc + node.confidence, 0) / Math.max(1, nodes.length);
    const prior = input.state.thesis;
    const confidence = Math.min(1, avgConfidence);
    const summary = prior?.summary ?? `Understanding graph updated for ${nodes.length} concepts.`;

    return {
      statePatch: {
        answers: currentAnswers,
        userPurpose,
        knowledgeLevel,
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
        valueVector,
        unitStates,
      },
      notes: ["Polymath understanding middleware synchronized state and confidence."],
    };
  }
}
