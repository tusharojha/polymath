import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

const UI_SCHEMA_PROMPT = `You are the Polymath UI Builder Agent.
You must output STRICT JSON for a safe UI schema (no JSX, no HTML).
Allowed kinds: workspace, section, header, card, list, prompt, input, select, button, hero.
Schema:
{
  "id": "string",
  "kind": "workspace",
  "props": { "templateColumns": "1fr", "gap": "6", "p": "12", "bg": "background" },
  "children": [
    { "id": "string", "kind": "header", "title": "string", "content": "string" },
    { "id": "string", "kind": "card", "title": "string", "content": "string" },
    { "id": "string", "kind": "list", "title": "string", "props": { "items": ["a","b"] } },
    { "id": "string", "kind": "input", "title": "string", "props": { "name": "q1", "placeholder": "string" } },
    { "id": "string", "kind": "select", "title": "string", "props": { "name": "q2", "options": ["a","b"] } },
    { "id": "string", "kind": "button", "title": "string", "props": { "action": "submit-answers", "meaning": "string" } }
  ]
}
Any interactive element must include props.action and props.meaning for the brain.`;

export class LearningStepBuilderAgent implements Agent {
  id = "learning-step-builder-agent";
  role = "learning-step-builder" as const;
  priority = 70;
  private readonly llm?: LLMClient;

  constructor(llm?: LLMClient) {
    this.llm = llm;
  }

  private async generateLayout(prompt: string, fallback: any) {
    if (!this.llm) return fallback;
    try {
      const text = await this.llm.generate(prompt);
      const parsed = JSON.parse(text);
      if (parsed && parsed.kind === "workspace") {
        return parsed;
      }
    } catch {
      return fallback;
    }
    return fallback;
  }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state } = input;
    if (state.phase === "questionnaire") {
      return null;
    }
    const nextUnitSignal = state.recentSignals.find(s => s.payload?.kind === "ui-intent" && s.payload.action === "next-unit");

    if (nextUnitSignal) {
      // Find the next unit
      const modules = state.curriculum?.modules ?? [];
      let currentUnitFound = false;
      let nextUnit = null;

      for (const module of modules) {
        for (const unit of module.units) {
          if (currentUnitFound) {
            nextUnit = unit;
            break;
          }
          if (unit.id === state.activeStep?.unitId) {
            currentUnitFound = true;
          }
        }
        if (nextUnit) break;
      }

      if (nextUnit) {
        return {
          statePatch: {
            activeStep: undefined, // Clear to trigger rebuild
            // We could store the next unit ID in state to help builder
            pendingUnitId: nextUnit.id,
            curriculumProgress: {
              ...(state.curriculumProgress ?? {}),
              [state.activeStep?.unitId ?? ""]: "done",
              [nextUnit.id]: "in_progress",
            },
          },
          notes: ["Progression intent detected; moving to next unit."]
        };
      }
    }

    if (state.activeStep && !nextUnitSignal) {
      return null;
    }
    if (!state.curriculum || state.phase !== "learning") {
      return null;
    }

    // Find the unit to build
    const modules = state.curriculum.modules;
    let targetUnit = modules[0]?.units[0]; // Default to first

    if (state.pendingUnitId) {
      for (const m of modules) {
        const u = m.units.find(unit => unit.id === state.pendingUnitId);
        if (u) {
          targetUnit = u;
          break;
        }
      }
    }

    const stepTitle = targetUnit?.title ?? "Adaptive learning surface";
    const layout = {
      id: `layout-${Date.now()}`,
      title: stepTitle,
      nodes: [],
    };

    return {
      statePatch: {
        activeStep: {
          id: `step-${Date.now()}`,
          goalId: state.goal.id,
          title: stepTitle,
          rationale: targetUnit?.objective ?? "Start from first principles.",
          senses: ["visual", "infographic", "experiment"],
          prompts: [
            "Explain the core primitives in your own words.",
            "Sketch a quick map of how they relate.",
          ],
          unitId: targetUnit?.id,
          layout,
        },
        curriculumProgress: {
          ...(state.curriculumProgress ?? {}),
          ...(targetUnit?.id ? { [targetUnit.id]: "in_progress" } : {}),
        },
        pendingUnitId: null // Clear it
      },
      intents: [
        {
          type: "build-step",
          title: stepTitle,
          layoutHint: "workspace",
          senses: ["visual", "infographic", "experiment"],
          layout,
        }
      ],
    };
  }
}
