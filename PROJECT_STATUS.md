# Polymath Project Status & Implementation Roadmap

**Date:** 2026-02-01
**Overall Status:** Pre-Alpha / Skeleton
**Architecture:** Solid Foundation (Monorepo, Electron, LangGraph), but Logic is "Stubbed".

## 1. Codebase Health Check

| Package | Status | Findings |
| :--- | :--- | :--- |
| **`apps/desktop`** | 🟡 **Buggy** | UI is rigid/static. Main process logic was crashing (now patched with logging). Uses `renderer.ts` instead of React components for UI. |
| **`packages/brain`** | 🟢 **Stable Stub** | `BrainRuntime` exists and initializes agents. Database (`better-sqlite3`) setup is present but unverified in production. |
| **`packages/agents`** | 🟡 **Skeleton** | All 7 agents exist but have **0 intelligence**. Logic is hardcoded `if/else` or random increments. No LLM integration yet. |
| **`packages/senses`** | 🟡 **Types Only** | Defines `SensePlugin` and `SenseController` interfaces, but the default implementations just return static signals. No actual React UI for senses. |
| **`packages/ui-builder`** | 🔴 **Empty** | Contains strict TypeScript interfaces (`SurfaceNode`, `LearningSurface`) but **0 implementations**. No code to actually build a UI from these types. |
| **`packages/core`** | 🟢 **Minimal** | Basic domain types. Safe. |

## 2. Critical Issues Identified

1.  **IPC "Reply Was Never Sent" Crash**:
    *   **Cause**: The `platform:brain:start` handler was crashing silently (likely `better-sqlite3` native binding mismatch or missing `OPENAI_API_KEY`).
    *   **Fix In-Progress**: Added try/catch logging to `main.ts` to diagnose.
2.  **No "Brain" (Intelligence Gap)**:
    *   `UnderstandingAgent` is a simple counter (`confidence += 0.03`).
    *   `SenseOrchestrator` ignores context.
    *   **Impact**:The app does not "adapt" or "learn" as promised.
3.  **Missing "Disposable UI" Engine**:
    *   The vision relies on a `Learning Step Builder` creating custom UIs.
    *   **Reality**: `renderer.ts` hardcodes a specific grid layout. `packages/ui-builder` has no code to generate React components.
4.  **No Frontend Framework**:
    *   The `desktop` app uses vanilla DOM manipulation (`document.querySelector`) in `renderer.ts`.
    *   **Blocker**: Cannot build complex, reactive "Fluid Learning" interfaces without React/Solid/Svelte.

## 3. Implementation Roadmap

### Phase 1: Fix the Foundation (Immediate)
*   [ ] **Debug IPC**: Run app, capture crash log, fix `better-sqlite3` or API key issue.
*   [ ] **Frontend Upgrade**: Refactor `renderer.ts` to mount a **React Root**. Vanilla JS is insufficient for this vision.
*   [ ] **State Bridge**: Ensure `window.polymath` correctly pipes state from `BrainRuntime` to the React frontend.

### Phase 2: Reactify the Senses
*   [ ] **Implement `ui-builder`**: Create a `SurfaceRenderer` component that takes a `LearningSurface` JSON and renders React components.
*   [ ] **Real Senses**: Build actual React components for:
    *   `<SenseTypeText />` (Markdown/Article)
    *   `<SenseTypeChat />` (Socratic dialogue)
    *   `<SenseTypeFlashcard />` (Spaced repetition)

### Phase 3: Activate the Brain
*   [ ] **LLM Integration**: Connect `BrainRuntime` to OpenAI/DeepSeek API.
*   [ ] **Smart Agents**:
    *   **Understanding**: Use LLM to analyze user clicks/time and update the Graph.
    *   **Orchestrator**: Use LLM to select the best `Sense` based on the graph.
    *   **Builder**: Use LLM to generate the `LearningSurface` JSON layout.

### Phase 4: Persistence & Polish
*   [ ] **SQLite**: Verify `better-sqlite3` works in production builds (often tricky with Electron).
*   [ ] **Auth**: Replace `user-1` with real local profiles.

## Recommendations for Right Now
1.  **Switch `apps/desktop` to React**: You cannot build this dynamic vision with `innerHTML` strings.
2.  **Resolve the IPC Crash**: We cannot proceed until the backend stays alive.
