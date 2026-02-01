import type { CurriculumPlan, CurriculumTreeNode } from "@polymath/core";
import type { LLMClient } from "../llm/types";
import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { ResearchResult } from "../llm/research";

function buildFallbackCurriculum(topic: string, goalId: string): CurriculumPlan {
  const now = Date.now();
  return {
    id: `curriculum-${topic}-${now}`,
    goalId,
    createdAt: now,
    summary: `First-principles curriculum for ${topic}.`,
    story: `We begin by isolating the smallest primitives in ${topic}, build their interactions into a system, then apply them in real-world constraints until you can create novel outputs.`,
    tree: {
      id: "root",
      title: topic,
      goal: `Master ${topic} from first principles.`,
      keyLearnings: ["Core primitives", "System interactions", "Applied synthesis"],
      children: [
        {
          id: "foundations",
          title: "Foundations",
          goal: "Define irreducible concepts.",
          keyLearnings: ["Primitives", "Definitions", "Why each unit matters"],
        },
        {
          id: "systems",
          title: "Systems & interactions",
          goal: "Map dependencies and failure modes.",
          keyLearnings: ["Interactions", "Causal links", "What breaks if removed"],
        },
        {
          id: "applications",
          title: "Applications & synthesis",
          goal: "Apply knowledge to real constraints.",
          keyLearnings: ["Prototype", "Evidence", "Novel application"],
        },
      ],
    },
    modules: [
      {
        id: "module-1",
        title: "Foundations",
        rationale: "Define the primitives and why they matter.",
        units: [
          {
            id: "unit-1",
            title: "Core primitives",
            objective: `Identify the irreducible concepts in ${topic}.`,
            firstPrinciples: [
              "Define the smallest units that cannot be removed.",
              "Explain why each unit is necessary.",
            ],
            checkpoints: ["Explain the primitives in your own words."],
          },
        ],
      },
      {
        id: "module-2",
        title: "Systems & interactions",
        rationale: "Show how the primitives interact and what breaks without them.",
        units: [
          {
            id: "unit-2",
            title: "Interactions",
            objective: "Map interactions and dependencies.",
            firstPrinciples: [
              "Show causal links between primitives.",
              "Remove one primitive and observe the outcome.",
            ],
            checkpoints: ["Sketch a dependency map."],
          },
        ],
      },
      {
        id: "module-3",
        title: "Applications & synthesis",
        rationale: "Apply knowledge to create artifacts and innovations.",
        units: [
          {
            id: "unit-3",
            title: "Applied build",
            objective: "Build a practical experiment or project.",
            firstPrinciples: [
              "Translate primitives into a real-world constraint.",
              "Validate with evidence.",
            ],
            checkpoints: ["Deliver a small prototype or report."],
          },
        ],
      },
    ],
  };
}


function collectTreeIds(node: any, acc: Record<string, "not_started">) {
  if (!node) return acc;
  if (node.id) acc[node.id] = "not_started";
  (node.children ?? []).forEach((child: any) => collectTreeIds(child, acc));
  return acc;
}

function sanitizeTree(node: any): CurriculumTreeNode {
  const children = Array.isArray(node.children)
    ? node.children.map(sanitizeTree)
    : [];

  return {
    id: typeof node.id === "string" ? node.id : `node-${Date.now()}-${Math.random()}`,
    title: typeof node.title === "string" ? node.title : "Untitled Node",
    goal: typeof node.goal === "string" ? node.goal : "",
    keyLearnings: Array.isArray(node.keyLearnings)
      ? node.keyLearnings.filter((k: any) => typeof k === "string")
      : [],
    children: children.length > 0 ? children : undefined,
  };
}

function treeFromModules(topic: string, modules: any[]) {
  return {
    id: "root",
    title: topic,
    goal: `Master ${topic} from first principles.`,
    keyLearnings: modules.flatMap((m) => m.title).slice(0, 5),
    children: modules.map((module, moduleIndex) => ({
      id: `module-${moduleIndex + 1}`,
      title: module.title ?? `Module ${moduleIndex + 1}`,
      goal: module.rationale ?? "",
      keyLearnings: module.units?.map((u: any) => u.title).slice(0, 5) ?? [],
      children:
        module.units?.map((unit: any, unitIndex: number) => ({
          id: `unit-${moduleIndex + 1}-${unitIndex + 1}`,
          title: unit.title ?? `Unit ${unitIndex + 1}`,
          goal: unit.objective ?? "",
          keyLearnings: unit.checkpoints ?? [],
        })) ?? [],
    })),
  };
}

const CURRICULUM_SYSTEM_PROMPT = `You are the Polymath Principal Curriculum Architect.
Your task is to design a high-fidelity, specialist-level curriculum that takes a user from Zero (Foundations) to 100 (Domain Specialist/Innovator).

CORE PHILOSOPHY:
1. First-Principles: Start with irreducible concepts.
2. Systemic Depth: Map every causal link and dependency.
3. Specialist Trajectory: 
   - 0-20: Foundations & Primitives
   - 20-60: Systems & Interactions
   - 60-90: Advanced Synthesis & Real-world constraints
   - 90-100: Specialist Innovation & Frontier Challenges

STRUCTURE:
- Provide a deep tree-like hierarchy (at least 10-15 modules).
- Each module must represent a clear phase in the 0-100 journey.

SCHEMA:
Return STRICT JSON:
{
  "summary": "High-level vision of the journey",
  "story": "A compelling narrative of how the user will evolve",
  "tree": {
    "id": "root",
    "title": "Main Goal",
    "goal": "Specialist mastery description",
    "keyLearnings": ["Mastery checkpoint 1", "Mastery checkpoint 2"],
    "children": [
      {
        "id": "mod-1",
        "title": "Module Title",
        "goal": "What is mastered here",
        "keyLearnings": ["sub-skill 1", "sub-skill 2"],
        "children": [
          { "id": "unit-1-1", "title": "Unit Title", "goal": "Specific objective" }
        ]
      }
    ]
  },
  "modules": [
    {
      "title": "Matching Title from tree",
      "rationale": "Why this specific knowledge is critical for a specialist",
      "units": [
        {
          "title": "Match title from tree",
          "objective": "Zero-to-100 mission",
          "firstPrinciples": ["The smallest irreducible unit", "Causal dependency", "What breaks if removed"],
          "checkpoints": ["Specialist-level artifact to build", "Advanced verification method"]
        }
      ]
    }
  ]
}

If Research Notes are provided, ground every module in the specific papers, trade-offs, and advanced concepts found in the research.`;

export class CurriculumAgent implements Agent {
  id = "curriculum-agent";
  role = "curriculum" as const;
  priority = 75;
  private readonly llm: LLMClient;
  private readonly research?: (topic: string) => Promise<ResearchResult>;

  constructor(llm: LLMClient, research?: (topic: string) => Promise<ResearchResult>) {
    this.llm = llm;
    this.research = research;
  }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const requested = input.state.pendingIntents.find(
      (intent) => intent.type === "draft-curriculum"
    );
    if (!requested || requested.type !== "draft-curriculum") {
      return null;
    }

    // If we have questions to ask, we WAIT for answers unless they are already there
    if (input.state.questions && input.state.questions.length > 0 && !input.state.answers) {
      return null;
    }

    if (!this.llm) {
      const curriculum = buildFallbackCurriculum(input.state.goal.title, input.state.goal.id);
      return {
        statePatch: {
          curriculum,
          curriculumProgress: curriculum.tree ? collectTreeIds(curriculum.tree, {}) : {},
        },
      };
    }

    const research = this.research ? await this.research(input.state.goal.title) : null;
    const researchBlock = research
      ? `\nRESEARCH INSIGHTS (Advanced Concepts/Trade-offs):\nNotes: ${research.notes}\nSources: ${JSON.stringify(research.sources).slice(0, 4000)}`
      : "";

    const answersBlock = input.state.answers
      ? `\nUSER CONTEXT (Background/Goals):\n${JSON.stringify(input.state.answers)}`
      : "";

    const userPurpose = input.state.userPurpose ? `\nUSER PURPOSE: ${input.state.userPurpose}` : "";

    const prompt = `${CURRICULUM_SYSTEM_PROMPT}

TOPIC: ${input.state.goal.title}${userPurpose}${answersBlock}${researchBlock}

Draft a 10-15 module specialist-level curriculum. Ground it in the research provided.`;

    const text = await this.llm.generate(prompt);
    if (!text) {
      return {
        statePatch: {
          curriculum: buildFallbackCurriculum(input.state.goal.title, input.state.goal.id),
        },
      };
    }

    try {
      const parsed = JSON.parse(text) as {
        summary?: string;
        story?: string;
        tree?: {
          id?: string;
          title?: string;
          goal?: string;
          keyLearnings?: string[];
          children?: any[];
        };
        modules?: Array<{
          title?: string;
          rationale?: string;
          units?: Array<{
            title?: string;
            objective?: string;
            firstPrinciples?: string[];
            checkpoints?: string[];
          }>;
        }>;
      };
      if (parsed.modules && parsed.modules.length > 0) {
        const rawTree = parsed.tree ?? treeFromModules(input.state.goal.title, parsed.modules);
        const tree = sanitizeTree(rawTree);
        const progress = tree ? collectTreeIds(tree, {}) : {};
        return {
          statePatch: {
            curriculum: {
              id: `curriculum-${input.state.goal.title}-${Date.now()}`,
              goalId: input.state.goal.id,
              createdAt: Date.now(),
              summary: parsed.summary ?? `First-principles curriculum for ${input.state.goal.title}.`,
              story: parsed.story,
              tree,
              modules: parsed.modules.map((module, moduleIndex) => ({
                id: `module-${moduleIndex + 1}`,
                title: module.title ?? `Module ${moduleIndex + 1}`,
                rationale: module.rationale ?? "",
                units:
                  module.units?.map((unit, unitIndex) => ({
                    id: `unit-${moduleIndex + 1}-${unitIndex + 1}`,
                    title: unit.title ?? `Unit ${unitIndex + 1}`,
                    objective: unit.objective ?? "",
                    firstPrinciples: unit.firstPrinciples ?? [],
                    checkpoints: unit.checkpoints ?? [],
                  })) ?? [],
              })),
            },
            phase: "learning",
            curriculumProgress: progress,
          },
          notes: ["LLM curriculum parsed from JSON."],
        };
      }
    } catch (error) {
      const curriculum = buildFallbackCurriculum(input.state.goal.title, input.state.goal.id);
      return {
        statePatch: {
          curriculum,
          curriculumProgress: curriculum.tree ? collectTreeIds(curriculum.tree, {}) : {},
        },
        notes: [`Failed to parse curriculum JSON: ${(error as Error).message}`],
      };
    }

    const curriculum = buildFallbackCurriculum(input.state.goal.title, input.state.goal.id);
    return {
      statePatch: {
        curriculum,
        curriculumProgress: curriculum.tree ? collectTreeIds(curriculum.tree, {}) : {},
        phase: "learning",
      },
      notes: ["LLM output received; using fallback parser for v1."],
    };
  }
}
