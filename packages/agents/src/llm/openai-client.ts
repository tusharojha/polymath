import OpenAI from "openai";
import type { LLMClient } from "./types";

export class OpenAIResponsesClient implements LLMClient {
  private openai: OpenAI;
  private model: string;
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private minDelayMs = 450;

  constructor(params: { apiKey: string; model?: string }) {
    this.openai = new OpenAI({
      apiKey: params.apiKey,
      dangerouslyAllowBrowser: true, // Only if used in renderer, but we are in bridge/main mostly
    });
    this.model = params.model ?? "gpt-5-mini";
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.minDelayMs - (now - this.lastRequestAt));
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      try {
        return await task();
      } finally {
        this.lastRequestAt = Date.now();
      }
    };

    const result = this.queue.then(run, run);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async withRetry<T>(task: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await task();
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 429 && attempt < 3) {
        const backoff = 800 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        return this.withRetry(task, attempt + 1);
      }
      throw error;
    }
  }

  async generate(prompt: string): Promise<string> {
    return this.enqueue(() =>
      this.withRetry(async () => {
        const isJson = prompt.toLowerCase().includes("json");
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: "You are a helpful assistant. If you are asked to return JSON, ensure your response is a valid JSON object." },
            { role: "user", content: prompt }
          ],
          ...(isJson ? { response_format: { type: "json_object" } } : {}),
        });

        return response.choices[0]?.message?.content ?? "";
      })
    );
  }

  async generateImage(prompt: string): Promise<string> {
    return this.enqueue(() =>
      this.withRetry(async () => {
        const response = await this.openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
        });

        return response.data?.[0]?.url ?? "";
      }).catch((error: any) => {
        console.error("OpenAI image generation error:", error);
        return "";
      })
    );
  }
}
