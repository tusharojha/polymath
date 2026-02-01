# Polymath Codebase Audit

**Date:** 2026-02-01
**Status:** Architecture Exists but is "Skeleton Status"
**Critical Bug:** "Brain runtime is not available" error preventing execution.

## 1. Top-Level Issues
| Severity | Issue | Location | Description |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | **Broken Bridge** | `renderer.ts` / `preload.ts` | The renderer fails to detect `window.polymath.brain` on startup. This causes the app to halt at "Brain runtime is not available." |
| **HIGH** | **Hardcoded User** | `main.ts` | `userId` is hardcoded to `"user-1"` and `goalId` to `"goal-1"`. No functional auth or session management. |
| **HIGH** | **Null LLM Default** | `runtime.ts` | `BrainRuntime` defaults to `NullLLMClient` if no API key is passed. The system effectively has "no brain" without configuration. |

## 2. Agent Implementation Audit
The agent architecture (LangGraph) is **correctly implemented**, but the *logic* within agents is currently rudimentary/hardcoded.

### Understanding Agent (`understanding-agent.ts`)
*   **Current State**: Rudimentary Heuristic.
*   **Logic**: Simply increments confidence by `0.03` for every signal observed.
*   **Gap**: No real inference of user understanding. Ignores *incorrect* answers or confusion signals.
*   **Vision Mismatch**: Should be a probabilistic model, currently a linear counter.

### Sense Orchestrator Agent (`sense-orchestrator-agent.ts`)
*   **Current State**: Simple If/Else.
*   **Logic**:
    *   If `confidence < 0.5` -> Show "Paper" (Text).
    *   Else -> Show "Experiment".
*   **Gap**: Ignores user preferences, learning styles, or energy levels.
*   **Vision Mismatch**: Supposed to be a dynamic strategist; currently a toggle switch.

### Learning Step Builder Agent
*   **Current State**: Stubbed.
*   **Gap**: Does not generate dynamic UI. Relies on pre-built "Sense" cards.
*   **Vision Mismatch**: Vision calls for "Disposable UI" generated JIT. Currently relies on static types (`visual`, `paper`, `experiment`).

## 3. Architecture Gaps

### The "Disposable UI" Gap
The frontend (`renderer.ts`) is currently a **Static shell** that renders cards.
*   **Current**: `intentsEl.innerHTML = ...` mapping over fixed templates.
*   **Vision**: The *structure* of the page itself should be fluid. The current `renderer.ts` is too rigid. It expects a fixed grid of `curriculum`, `step`, `intents`, `senses`.

### The "Understanding Thesis" Gap
*   **Current**: `InMemoryUnderstandingState` (Redux-like object).
*   **Vision**: Directed Acyclic Graph (DAG).
*   **Reality**: The code has a `thesis` object, but it's not treated as a graph. It's just a summary string + confidence float.

## 4. Recommendations
1.  **Fix the Bridge**: Debug why `window.polymath` is missing in renderer (likely build configuration or race condition).
2.  **Connect LLM**: Ensure `OPENAI_API_KEY` is plumbing through to `BrainRuntime`.
3.  **Upgrade Understanding**: Move from `+0.03` logic to a prompt-based evaluation: "Given these signals, update the user's mental model."
4.  **Dynamic Renderer**: Rewrite `renderer.ts` to accept a `LayoutSchema` rather than hardcoded DOM elements, allowing the `Learning Step Builder` to control the UI structure.
