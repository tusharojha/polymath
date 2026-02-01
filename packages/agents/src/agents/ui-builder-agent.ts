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
    // Default to procedural for speed and rate-limit conservation
    surface = this.composeSurfaceProcedural(state);

    if (!surface) {
      try {
        surface = await this.composeSurfaceLLM(state);
      } catch (err) {
        console.error("LLM UI Composition failed:", err);
        return null;
      }
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
           "onSubmit": "Description of intent for the Brain (e.g. 'User submitted the form, next do this: <next action>')",
           "sduiAction": "submit-answers" // EXPLICIT ACTION: Use 'submit-answers' for questionnaire submission
        }
      ]
    }
  ]
}

DESIGN RULES:
1. Use "flex" for layout. Use "className" in flexBoxProperties for Tailwind classes (e.g. "flex-col gap-4").
2. Use "component" for leaf nodes. Supported: Heading, Text, Box, Button, Input, Select, Divider, ExperimentViewer, SvgBlock, CodeBlock, MermaidBlock.
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
13. EXPOSITION FIRST: In the "learning" phase, always render the "teachingContent.explanation" as the hero element. Do not include assessment inputs (from activeStep.prompts) on the first render of a unit; focus on teaching.

CURRENT DATA:
${JSON.stringify({
      thesis: state.thesis?.summary,
      questions: state.questions,
      activeStep: state.activeStep,
      senseOutputs: (state.recentSignals ?? []).filter((s: any) => s.payload?.kind === "sense-output").map((s: any) => s.payload.output)
    }, null, 2)}

Return ONLY valid json format.
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
    const unitId = step?.unitId;
    const teachingContent = unitId ? state.knowledgeRepository?.[unitId] : null;

    const title = teachingContent?.title ?? step?.title ?? state.goal?.title ?? "Learning";
    const rawExplanation = (teachingContent?.explanation ?? step?.rationale ?? "").toString().trim() || "Generating lesson content...";

    // Resolve Media Components
    const mediaComponents = (teachingContent?.media || []).map((item: any, idx: number) => {
      const titleComp = item.title ? {
        type: "component",
        componentName: "Text",
        props: { children: item.title, className: "text-xs uppercase tracking-widest text-fgSubtle" }
      } : null;

      const baseFlex = {
        type: "flex",
        flexBoxProperties: { className: "flex-col gap-3 p-4 rounded-xl border border-border bg-surface my-4" },
      };

      if (item.kind === "svg" || item.kind === "diagram") {
        return { ...baseFlex, contents: [...(titleComp ? [titleComp] : []), { type: "component", componentName: "SvgBlock", props: { svg: item.content } }] };
      }
      if (item.kind === "mermaid") {
        return { ...baseFlex, contents: [...(titleComp ? [titleComp] : []), { type: "component", componentName: "MermaidBlock", props: { code: item.content, unitId, mediaIndex: idx } }] };
      }
      if (item.kind === "markdown" && typeof item.content === "string") {
        const mermaidMatch = item.content.match(/```mermaid([\s\S]*?)```/i);
        if (mermaidMatch) {
          const mermaidCode = mermaidMatch[1].trim();
          return { ...baseFlex, contents: [...(titleComp ? [titleComp] : []), { type: "component", componentName: "MermaidBlock", props: { code: mermaidCode, unitId, mediaIndex: idx } }] };
        }
      }
      if (item.kind === "code") {
        return { ...baseFlex, contents: [...(titleComp ? [titleComp] : []), { type: "component", componentName: "CodeBlock", props: { code: item.content, language: item.language } }] };
      }
      return { ...baseFlex, contents: [...(titleComp ? [titleComp] : []), { type: "component", componentName: "Text", props: { children: item.content, className: "text-sm text-fgMuted" } }] };
    });

    // Resolve Sense/Artifact Components
    const artifactMap = new Map<string, any>();

    // Check state.artifacts first (from LabsAgent)
    (state.artifacts || []).forEach((art: any) => {
      if (art.kind === "experiment") {
        artifactMap.set(`experiment-${art.unitId}`, {
          type: "component",
          componentName: "ExperimentViewer",
          props: { code: art.code }
        });
      }
    });

    // Then check sense-outputs from signals
    (state.recentSignals || [])
      .filter((s: any) => s.payload?.kind === "sense-output")
      .forEach((s: any) => {
        (s.payload.output.artifacts || []).forEach((art: any) => {
          if (art.kind === "experiment" && art.code) {
            artifactMap.set(`experiment-${unitId}`, {
              type: "component",
              componentName: "ExperimentViewer",
              props: { code: art.code }
            });
          }
          if (art.kind === "experiment_stub") {
            artifactMap.set("experiment_stub", {
              type: "flex",
              flexBoxProperties: { className: "flex-col gap-3 p-5 rounded-xl border border-border bg-surface my-4" },
              contents: [
                { type: "component", componentName: "Text", props: { children: art.title || "Interactive Lab", className: "font-bold text-fg" } },
                { type: "component", componentName: "Text", props: { children: art.description || "Load the experiment when ready.", className: "text-sm text-fgMuted" } },
                {
                  type: "component",
                  componentName: "Button",
                  props: { children: "Load Experiment", className: "btn btn-solid w-full" },
                  onSubmit: "Generate and load the interactive experiment for this concept.",
                  sduiAction: "load-experiment",
                  sduiData: { prompt: art.prompt }
                }
              ]
            });
          }
          if (art.kind === "infographic" && art.url) {
            artifactMap.set("infographic", {
              type: "flex",
              flexBoxProperties: { className: "flex-col gap-3 p-4 rounded-xl border border-border bg-surface my-4 max-w-[500px] mx-auto w-full" },
              contents: [
                { type: "component", componentName: "Text", props: { children: art.title || "Infographic", className: "text-xs uppercase tracking-widest text-fgSubtle" } },
                {
                  type: "component", componentName: "Box", props: { className: "aspect-square w-full rounded-lg overflow-hidden border border-border bg-black" }, contents: [
                    { type: "component", componentName: "Image", props: { src: art.url, alt: art.description, className: "w-full h-full object-cover" } }
                  ]
                }
              ]
            });
          }
        });
      });

    // INTERLEAVING LOGIC
    const contents: any[] = [];
    const markerRegex = /::(media|sense):(\d+)::/g;
    const hasMarkers = markerRegex.test(rawExplanation);
    markerRegex.lastIndex = 0;
    let lastIndex = 0;
    let match;

    const primaryExplanation = rawExplanation.replace(/::(media|sense):(\d+)::/g, "").trim();
    if (primaryExplanation) {
      contents.push({ type: "component", componentName: "Text", props: { children: primaryExplanation, className: "text-lg text-fgMuted leading-relaxed markdown-content" } });
    }

    while ((match = markerRegex.exec(rawExplanation)) !== null) {

      const type = match[1];
      const index = parseInt(match[2], 10);

      if (type === "media" && mediaComponents[index]) {
        contents.push(mediaComponents[index]);
      } else if (type === "sense") {
        const senseTarget = teachingContent?.senses?.[index];
        if (senseTarget) {
          // Find matching artifact
          let component = null;
          if (senseTarget.type === "experiment") component = artifactMap.get(`experiment-${unitId}`) ?? artifactMap.get("experiment_stub");
          else if (senseTarget.type === "infographic") component = artifactMap.get("infographic");

          if (component) {
            contents.push(component);
          } else {
            contents.push({ type: "component", componentName: "Text", props: { children: `Sense active: Generating ${senseTarget.type}...`, className: "italic text-fgSubtle my-4" } });
          }
        }
      }
      lastIndex = markerRegex.lastIndex;
    }

    if (!hasMarkers) {
      contents.push(...mediaComponents);
      artifactMap.forEach(v => contents.push(v));
    }

    // Interjections
    const interjections = (teachingContent?.interjections || []).map((ij: any) => ({
      type: "flex",
      flexBoxProperties: { className: "p-6 bg-accent/5 rounded-xl border border-accent/20 my-6 flex-col gap-3" },
      contents: [
        { type: "component", componentName: "Text", props: { children: `Insight: ${ij.question}`, className: "font-bold text-accent" } },
        { type: "component", componentName: "Text", props: { children: ij.answer, className: "text-fg" } },
        { type: "component", componentName: "Text", props: { children: `Why it matters: ${ij.motivation}`, className: "text-xs text-fgSubtle" } }
      ]
    }));

    return {
      pageContext: {
        purposeOfThisRender: "Present first-principles lesson",
        predictedNextAction: "User will follow the logic or explore senses"
      },
      state: state.unitStates?.[unitId || ""] ?? {},
      components: [
        {
          type: "flex",
          flexBoxProperties: { className: "flex-col gap-6 p-8" },
          contents: [
            { type: "component", componentName: "Heading", props: { children: title, className: "text-3xl font-bold text-fg tracking-tight" } },
            ...contents,
            ...interjections,
            {
              type: "flex",
              flexBoxProperties: { className: "flex-row gap-4 mt-8" },
              contents: [
                { type: "component", componentName: "Button", props: { children: "Next Concept", className: "btn btn-solid" }, onSubmit: "Advance to the next unit", sduiAction: "next-unit" },
                { type: "component", componentName: "Button", props: { children: "Deep Dive", className: "btn btn-ghost" }, onSubmit: "Request specialized details", sduiAction: "deep-dive" }
              ]
            }
          ]
        }
      ]
    };
  }
}
