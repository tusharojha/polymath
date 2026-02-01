import type { SenseInput, SenseOutput } from "../index";

const EXPERIMENT_PROMPT = `You are the Polymath Experiment Designer.
Generate a single-file interactive experiment using HTML+CSS+JS and Three.js.
Rules:
- Output ONLY the HTML body content (no <html>, <head> tags).
- Include <style> and <script> tags inside the body content.
- Use Three.js via CDN: https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js
- Keep it lightweight; no external assets.
- Add a short on-screen title and instructions.
`;

export async function generateExperimentHTML(
  prompt: string,
  llm: { generate: (p: string) => Promise<string> }
): Promise<string> {
  const response = await llm.generate(`${EXPERIMENT_PROMPT}\nTask: ${prompt}`);
  if (!response) {
    return `<div style="padding:16px;color:#e5e7eb;">Experiment unavailable.</div>`;
  }
  return response;
}

export async function runExperimentSense(
  input: SenseInput,
  llm: { generate: (p: string) => Promise<string> }
): Promise<SenseOutput> {
  const html = await generateExperimentHTML(
    input.prompt ?? "Create an interactive physics experiment.",
    llm
  );
  return {
    signals: [
      {
        kind: "sense-presented",
        senseType: "experiment",
        goalId: input.context.goal.id,
        timestamp: Date.now(),
      },
    ],
    artifacts: [
      {
        kind: "experiment",
        title: "Interactive Lab",
        description: "Hands-on exploration generated for this concept.",
        code: html,
      },
    ],
  };
}
