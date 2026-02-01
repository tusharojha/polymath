export interface LLMClient {
  generate(prompt: string): Promise<string>;
}

export class NullLLMClient implements LLMClient {
  async generate(prompt: string): Promise<string> {
    return `LLM disabled. Prompt preview: ${prompt.slice(0, 240)}`;
  }
}
