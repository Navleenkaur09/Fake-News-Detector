declare module "openai" {
  class OpenAI {
    constructor(config: { apiKey?: string });
    chat: {
      completions: {
        create(args: any): Promise<{
          choices: Array<{ message?: { content?: string } }>;
        }>;
      };
    };
  }

  export default OpenAI;
}

declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    [key: string]: string | undefined;
  };
};

declare const console: {
  error: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};
