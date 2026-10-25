/**
 * For clear, single-purpose requests, expose only the matching tool. This
 * prevents the model from doing speculative cross-table lookups before the
 * operation can be handled by its authoritative, scoped tool.
 */
export function getPendingClarificationToolName(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length < 2) return null;
  const previous = messages[messages.length - 2] as { role?: unknown; parts?: unknown };
  const latest = messages[messages.length - 1] as { role?: unknown };
  if (previous?.role !== "assistant" || latest?.role !== "user" || !Array.isArray(previous.parts)) return null;

  for (const rawPart of previous.parts) {
    if (!rawPart || typeof rawPart !== "object") continue;
    const part = rawPart as { type?: unknown; toolInvocation?: unknown };
    if (part.type !== "tool-invocation" || !part.toolInvocation || typeof part.toolInvocation !== "object") continue;
    const invocation = part.toolInvocation as { toolName?: unknown; state?: unknown; result?: unknown };
    if (typeof invocation.toolName !== "string" || invocation.state !== "result" || !invocation.result || typeof invocation.result !== "object") continue;
    if ((invocation.result as { needsInput?: unknown }).needsInput === true) return invocation.toolName;
  }
  return null;
}

export function getFocusedToolNames(message: string, role?: string, pendingClarificationToolName: string | null = null): string[] | null {
  const text = message.toLocaleLowerCase();
  const asksToCreate = /\b(create|make|add|start|set up|build|generate|draft|prepare|write)\b/.test(text);
  if (role === "CLIENT" && pendingClarificationToolName === "prepare_client_feedback") return ["prepare_client_feedback"];
  if (role === "MANAGER" && pendingClarificationToolName === "create_invitation") return ["create_invitation"];
  if (role === "CLIENT" && asksToCreate && /\b(review|feedback)\b/.test(text)) {
    return ["prepare_client_feedback"];
  }
  if (
    role === "MANAGER" &&
    /\b(invite|invitation)\b/.test(text) &&
    /\b(create|send|prepare|make|issue|generate|invite)\b/.test(text)
  ) {
    return ["create_invitation"];
  }
  const mentionsProject = /\b(project|campaign)\b/.test(text);
  const mentionsTasks = /\b(task|tasks|shot list|deliverable|deliverables)\b/.test(text);

  if (asksToCreate && mentionsProject && mentionsTasks) return null;
  if (asksToCreate && mentionsProject) return ["create_project"];
  if (asksToCreate && mentionsTasks) return ["create_task_batch"];
  if (/\b(how many|count|number of|list|show me|give me|get me|fetch|retrieve)\b/.test(text)) {
    return ["query_studio_data"];
  }
  if (/\b(available|capacity|workload|queue load|who is free)\b/.test(text)) {
    return ["query_team_capacity"];
  }
  if (/\b(sla|deadline risk|overdue|due in|due soon)\b/.test(text)) {
    return ["query_sla_risks"];
  }
  if (/\b(find|search|look for|locate)\b/.test(text)) return ["smart_search"];

  return null;
}

export function restrictTools<T extends Record<string, unknown>>(
  tools: T,
  names: string[] | null,
): T {
  if (!names) return tools;
  return Object.fromEntries(Object.entries(tools).filter(([name]) => names.includes(name))) as T;
}
