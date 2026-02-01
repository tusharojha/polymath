import type { Agent, AgentInput, AgentUpdate } from "../types";
import type { LLMClient } from "../llm/types";

export class UIBuilderAgent implements Agent {
  id = "ui-builder-agent";
  role = "ui-builder" as const;
  priority = -100; // Run last to observe all state changes

  constructor(private readonly llm: LLMClient) { }

  async observe(input: AgentInput): Promise<AgentUpdate | null> {
    const { state } = input;

    // We only build a surface if we have enough context
    const hasContext = (state.phase === "intake" || state.questions) ||
      (state.curriculum && state.activeStep);

    if (!hasContext) return null;

    let surface;
    try {
      surface = await this.composeSurfaceLLM(state);
    } catch (err) {
      console.error("LLM UI Composition failed, falling back to procedural:", err);
      surface = this.composeSurfaceProcedural(state);
    }

    if (!surface) return null;

    if (JSON.stringify(state.learningSurface) === JSON.stringify(surface)) {
      return null;
    }

    return {
      statePatch: {
        learningSurface: surface
      },
      notes: ["UI Builder composed SDUI surface."]
    };
  }

  private async composeSurfaceLLM(state: any): Promise<any> {
    const prompt = `
You are the Lead UI Architect for Polymath.
Your goal is to generate a Server-Driven UI (SDUI) JSON response for the center content window.

CONTEXT:
User Goal: ${state.goal?.title || "Unknown"}
Phase: ${state.phase}
Active Step: ${state.activeStep?.title || "None"}
Curriculum: ${state.curriculum?.modules?.length || 0} modules

SCHEMA INSTRUCTIONS:
Return a single JSON object with this exact structure:
{
  "pageContext": {
    "purposeOfThisRender": "String describing why this UI exists",
    "predictedNextAction": "String describing the next step the application should do after this ui."
  },
  "state": {
    "key": "initialValue" // Dictionary of state variables binding to inputs
  },
  "components": [
    {
      "type": "flex",
      "flexBoxProperties": { "className": "flex-col gap-4 p-6" },
      "contents": [
        // Recursive components
        {
          "type": "component",
          "componentName": "Heading", // e.g. Box, Text, Button, Input, Select, Divider, Card
          "props": { "className": "text-lg font-bold", "children": "Title" }
        },
        {
           "type": "component",
           "componentName": "Button",
           "props": { "children": "Submit", "className": "btn btn-solid w-full" },
           "onSubmit": "Description of intent for the Brain (e.g. 'User submitted the form, next do this: <next action>')"
        }
      ]
    }
  ]
}

DESIGN RULES:
1. Use "flex" for layout. Use "className" in flexBoxProperties for Tailwind classes (e.g. "flex-col gap-4").
2. Use "component" for leaf nodes. Supported: Heading, Text, Box, Button, Input, Select, Divider.
3. Use "className" prop for styling. Do NOT use style props like "bg", "p", "m", "color".
4. Use standard Tailwind utility classes.
5. Create a rich, newspaper-like layout for learning content.
6. IMPORTANT: Every "Input" and "Select" MUST have a unique "name" property in "props" for state binding.
7. ACCESSIBILITY: Every "Input" and "Select" MUST have a label using the "Text" component (className: "text-sm text-fg") placed directly above it.
8. PLACEHOLDERS: Keep placeholders very short (e.g. "Select...", "Type here..."). Put full questions or descriptive prompts in the label "Text" component, NOT in the placeholder.
9. GROUPING: Wrap each label+field pair in a "flex" container with "flex-col gap-2" to ensure consistent vertical spacing.
10. SELECT OPTIONS: For "Select" components, always pass the options in the "options" prop as an array of objects: { "value": "ID", "label": "Text" }.
11. STYLING: Always use the "input" className for "Input" and "Select" components to ensure consistent design.
12. STATE BINDING: The "name" prop is what binds the value to the parent "state" object. Use descriptive keys (e.g. "userExperience", "projectGoal").

CURRENT DATA:
${JSON.stringify({
      thesis: state.thesis?.summary,
      questions: state.questions,
      activeStep: state.activeStep
    }, null, 2)}

Return ONLY valid JSON.
`;

    const response = await this.llm.generate(prompt);
    console.log('response from uibuilder: ', response)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    return JSON.parse(jsonMatch[0]);
  }

  private composeSurfaceProcedural(state: any): any {
    const isIntake = state.phase === "intake" || state.phase === "questionnaire" || (state.questions && !state.answers);

    if (isIntake) {
      return this.composeIntakeSurface(state);
    }
    return this.composeLearningSurface(state);
  }

  private composeIntakeSurface(state: any): any {
    const questions = state.questions ?? [];
    const initialState: Record<string, any> = {};
    const formComponents: any[] = [];

    questions.forEach((q: any) => {
      initialState[q.id] = "";
      formComponents.push({
        type: "flex",
        flexBoxProperties: { className: "flex-col gap-2 mb-4" },
        contents: [
          {
            type: "component",
            componentName: "Text",
            props: { children: q.prompt, className: "font-bold text-sm text-fg" }
          },
          q.kind === "choice" ? {
            type: "component",
            componentName: "Select",
            props: {
              name: q.id, // binds to state[q.id]
              placeholder: "Select...",
              options: q.choices,
              className: "input"
            }
          } : {
            type: "component",
            componentName: "Input",
            props: {
              name: q.id, // binds to state[q.id]
              placeholder: "Type answer...",
              className: "input"
            }
          }
        ]
      });
    });

    return {
      pageContext: {
        purposeOfThisRender: "Collect user requirements for curriculum synthesis",
        predictedNextAction: "User will submit preferences"
      },
      state: initialState,
      components: [
        {
          type: "flex",
          flexBoxProperties: { className: "flex-col gap-6 p-8 max-w-[800px] mx-auto" },
          contents: [
            {
              type: "component",
              componentName: "Heading",
              props: { children: `Setup: ${state.goal?.title}`, className: "text-2xl font-bold mb-4" }
            },
            ...formComponents,
            {
              type: "component",
              componentName: "Button",
              props: {
                children: "Generate Curriculum",
                className: "btn btn-solid w-full mt-4"
              },
              onSubmit: "Submit intake answers to generate curriculum",
              sduiAction: "submit-answers"
            }
          ]
        }
      ]
    };
  }

  private composeLearningSurface(state: any): any {
    const step = state.activeStep;
    const title = step?.title ?? state.goal?.title ?? "Learning";

    // Create artifacts section
    const artifacts = (state.recentSignals || [])
      .filter((s: any) => s.payload?.kind === "sense-output")
      .flatMap((s: any) => s.payload.output.artifacts || [])
      .map((art: any) => ({
        type: "component",
        componentName: "Box",
        props: { className: "p-4 bg-surface rounded-lg border border-border mb-4 card", children: art.description }
      }));

    return {
      pageContext: {
        purposeOfThisRender: "Present learning material",
        predictedNextAction: "User will read or click next"
      },
      state: {}, // No input state needed for read-only, but maybe for interactive elements later
      components: [
        {
          type: "flex",
          flexBoxProperties: { className: "flex-col gap-6 p-8" },
          contents: [
            {
              type: "component",
              componentName: "Heading",
              props: { children: title, className: "text-3xl font-bold text-fg tracking-tight" }
            },
            {
              type: "component",
              componentName: "Text",
              props: { children: step?.rationale ?? "Loading content...", className: "text-lg text-fgMuted leading-relaxed" }
            },
            {
              type: "flex",
              flexBoxProperties: { className: "flex-col gap-4 mt-6" },
              contents: artifacts.length ? artifacts : [
                { type: "component", componentName: "Text", props: { children: "No specific artifacts yet.", className: "italic text-fgSubtle" } }
              ]
            },
            {
              type: "flex",
              flexBoxProperties: { className: "flex-row gap-4 mt-8" },
              contents: [
                {
                  type: "component",
                  componentName: "Button",
                  props: { children: "Next Unit", className: "btn btn-solid" },
                  onSubmit: "Advance to the next module"
                },
                {
                  type: "component",
                  componentName: "Button",
                  props: { children: "Deep Dive", className: "btn btn-ghost" },
                  onSubmit: "Request detailed explanation"
                }
              ]
            }
          ]
        }
      ]
    };
  }
}
