import { messageModule } from './tools/message';
import { ToolModule } from './types';

const modules: ToolModule[] = [messageModule];

export const ALL_TOOLS = modules.flatMap(m => m.tools);

export async function handleTool(name: string, args: Record<string, unknown>): Promise<string> {
  const mod = modules.find(m => m.tools.some(t => t.name === name));
  if (!mod) throw new Error(`Unknown tool: ${name}`);
  return mod.handle(name, args);
}
