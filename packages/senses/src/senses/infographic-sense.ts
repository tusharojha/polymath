import type { SenseInput, SenseOutput } from "../index";

const INFOGRAPHIC_SYSTEM_PROMPT = `You are the Polymath Visual Designer.
Your goal is to describe a high-fidelity, educational infographic that explains a complex concept.
The description will be used to generate an image using DALL-E 3.

INSTRUCTIONS:
1. Content: Focus on first-principles, systemic relationships, and clarity.
2. Style: Professional, minimalist, with a dark slate background (#0b0f16) and accent colors (blue/cyan).
3. Text: Minimal text on the actual image (DALL-E is better at shapes than long sentences). Focus on icons and flow.
4. Composition: Vector-style, 2D, clean layouts.
`;

export async function generateInfographicPrompt(
  prompt: string,
  llm: { generate: (p: string) => Promise<string>; generateImage: (p: string) => Promise<string> }
): Promise<string> {
  const metaPrompt = `${INFOGRAPHIC_SYSTEM_PROMPT}\n\nUser Request: ${prompt}\n\nTask: Generate a detailed physical description prompt for DALL-E 3 that captures this educational concept visually.`;
  return await llm.generate(metaPrompt);
}

export async function runInfographicSense(
  input: SenseInput,
  llm: { generate: (p: string) => Promise<string>; generateImage: (p: string) => Promise<string> }
): Promise<SenseOutput> {
  const visualDescription = await generateInfographicPrompt(
    input.prompt ?? "A technical infographic about first principles.",
    llm
  );

  const imageUrl = await llm.generateImage(visualDescription);

  return {
    signals: [
      {
        kind: "sense-presented",
        senseType: "infographic",
        goalId: input.context.goal.id,
        timestamp: Date.now(),
      },
    ],
    artifacts: [
      {
        kind: "infographic",
        title: "Visual Synthesis",
        description: input.prompt ?? "A visual guide to the core principles.",
        url: imageUrl,
      },
    ],
  };
}
