import OpenAI from "openai";
import type { LLMClient } from "./types";

export class OpenAIResponsesClient implements LLMClient {
  private openai: OpenAI;
  private model: string;

  constructor(params: { apiKey: string; model?: string }) {
    this.openai = new OpenAI({
      apiKey: params.apiKey,
      dangerouslyAllowBrowser: true, // Only if used in renderer, but we are in bridge/main mostly
    });
    this.model = params.model ?? "gpt-4o-mini";
  }

  async generate(prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      console.error("OpenAI generation error:", error);
      throw error;
    }
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      return response.data?.[0]?.url ?? "";
    } catch (error) {
      console.error("OpenAI image generation error:", error);
      throw error;
    }
  }
}
