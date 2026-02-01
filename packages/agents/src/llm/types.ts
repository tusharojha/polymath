export interface LLMClient {
  generate(prompt: string): Promise<string>;
  generateImage(prompt: string): Promise<string>;
}

export class NullLLMClient implements LLMClient {
  async generate(prompt: string): Promise<string> {
    return `LLM disabled. Prompt preview: ${prompt.slice(0, 240)}`;
  }
  async generateImage(prompt: string): Promise<string> {
    return "https://via.placeholder.com/1024x1024?text=Image+Mockup";
  }
}
