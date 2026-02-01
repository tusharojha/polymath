# Polymath

Polymath is an agentic learning OS that helps people become polymaths.

A polymath is a person who specializes in more than one field. In the age of AI, being only a generalist or a single-domain specialist is not enough. The future belongs to polymaths.

Polymath captures user interests, generates personalized curricula, and teaches through just-in-time studies, examples, illustrations, and experiments to keep learners curious, engaged, and aligned with their evolving learning needs.

## Why Polymath

- Learning is a graph, not a linear course.
- Interfaces should adapt to the moment.
- Understanding is probabilistic and evolves with real interaction.

Polymath is designed as a fluid learning OS, not a fixed course platform.

## What the app does

1. The user enters a learning goal.
2. The Brain (supervisor agent) seeds context and decides what to do next.
3. A curriculum is generated from first principles and stored (then locked).
4. Teaching starts with just-in-time lessons, senses, and experiments.
5. Understanding is updated continuously based on direct and indirect signals.
6. The UI is rendered from an LLM-driven schema (SDUI JSON) per step.

## Architecture at a glance

Polymath runs a multi-agent system in the Electron main process and renders a dynamic SDUI-based interface in the renderer.

Core packages:

- `@polymath/brain`: Orchestrator runtime (LangGraph) + storage (SQLite).
- `@polymath/agents`: Understanding, Planner, Curriculum, Teaching, Senses, UI Builder, Revision, Synthesis.
- `@polymath/senses`: Visuals, infographics, experiments, papers, audio, etc.
- `apps/desktop`: Electron app + SDUI renderer (React).

Shared state:

- A probabilistic understanding thesis.
- A curriculum tree with progress.
- Active learning step and sense outputs.
- Persistent knowledge repository per unit.

## Agent flow (simplified)

1. **Understanding Agent** updates the thesis from signals.
2. **Planner Agent** routes the next action.
3. **Question Agent** gathers missing context.
4. **Curriculum Agent** builds a 0-100, first-principles structure.
5. **Teaching Agent** generates deep explanations, media, and sense prompts.
6. **Sense Orchestrator** chooses representation (text, visual, experiment).
7. **UI Builder** generates SDUI JSON for the current step.
8. **Revision/Synthesis Agents** reinforce and prompt outputs.

## UI system

Polymath uses a Server-Driven UI (SDUI) model:

- The UI Builder returns JSON components and layout.
- The renderer maps the JSON to React components.
- User interactions are forwarded to the Brain as semantic intents.

This enables a disposable, adaptive UI tailored to every step.

## How we use OpenAI models, APIs, and tools

Polymath uses OpenAI models to drive its agentic brain and content generation:

- The Brain uses OpenAI's **Responses API** to power stateful, tool-friendly multi-turn agent workflows. 
- API keys are required for server-side calls and must be stored securely (never in client code). We load keys from `OPENAI_API_KEY` in environment variables. 
- Model choices can be tuned for cost, speed, and quality (for example, smaller models like GPT-4o mini for fast steps and larger models for deep synthesis).

## Future potential

Polymath is built to evolve:

- **Richer tools** via the Responses API toolchain (web search, file search, and more). citeturn1search1turn1search5turn1search7
- **Hybrid local + cloud** using open-weight models where privacy or offline use is required. citeturn0search5
- **Multi-modal curricula** with visuals, experiments, and real-time feedback loops.
- **Adaptive mastery tracking** based on long-term signal history and decay.

## Development

Install and run:

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build
```

## Security note

Never commit API keys. Store `OPENAI_API_KEY` in a local `.env` or your system environment. citeturn0search3
