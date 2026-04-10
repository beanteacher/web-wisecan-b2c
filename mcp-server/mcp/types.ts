export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolModule {
  tools: ToolDefinition[];
  handle(name: string, args: Record<string, unknown>): Promise<string>;
}
