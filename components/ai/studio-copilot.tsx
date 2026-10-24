"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Bot,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  Send,
  Wrench,
  ArrowRight,
  ExternalLink,
  Play,
  Check,
  Search,
  Minus,
  AlertCircle,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  Trace,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface StudioCopilotProps {
  initialMode?: "collapsed" | "drawer" | "center";
  copilotName?: string;
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1.5 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-base font-semibold">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 mt-3 text-sm font-semibold">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1.5 mt-2 text-xs font-semibold">{children}</h3>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="my-2 border-l-2 border-primary/50 pl-3 text-muted-foreground">{children}</blockquote>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-background/70 p-2 text-[0.9em]">{children}</pre>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{children}</a>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="my-2 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-[0.9em]">{children}</table></div>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="border border-border bg-background/60 px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

function getToolInvocations(message: UIMessage) {
  return message.parts?.flatMap((part) =>
    part.type === "tool-invocation" ? [part.toolInvocation] : [],
  ) ?? [];
}

function getMessageText(message: UIMessage) {
  return message.parts?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") ?? message.content;
}

export function StudioCopilot({ initialMode = "collapsed", copilotName = "WoPhoto Studio Copilot" }: StudioCopilotProps) {
  const [displayMode, setDisplayMode] = useState<"collapsed" | "drawer" | "center">(initialMode);
  const [proposalStatus, setProposalStatus] = useState<Record<string, { state: "applying" | "success" | "error"; message: string }>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
    setMessages,
    reload,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome-msg",
        role: "assistant",
        content: `Hello, I am ${copilotName}. I can search reviews, create tasks, inspect retoucher capacity, or flag SLA deadlines. How can I assist you today?`,
      },
    ],
  });
  const isLoading = status === "submitted" || status === "streaming";

  // Focus input when opening drawer or center
  useEffect(() => {
    if (displayMode === "drawer") {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else if (displayMode === "center") {
      setTimeout(() => commandInputRef.current?.focus(), 150);
    }
  }, [displayMode]);

  // Global keyboard shortcuts: Cmd+J for floating drawer, Cmd+K for command center, Escape to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setDisplayMode((prev) => (prev === "collapsed" ? "drawer" : "collapsed"));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDisplayMode((prev) => (prev === "center" ? "drawer" : "center"));
      } else if (e.key === "Escape") {
        if (displayMode === "center") {
          setDisplayMode("drawer");
        } else if (displayMode === "drawer") {
          setDisplayMode("collapsed");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayMode]);

  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: "Chat session refreshed. How can I help you?",
      },
    ]);
  };

  const handleConfirmProposal = async (
    proposalId: string,
    proposalType: string,
    payload: unknown,
  ) => {
    setProposalStatus((prev) => ({ ...prev, [proposalId]: { state: "applying", message: "Applying…" } }));
    try {
      const response = await fetch("/api/chat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalType, payload }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "The proposal could not be applied.");
      setProposalStatus((prev) => ({ ...prev, [proposalId]: { state: "success", message: result.message || "Applied successfully." } }));
    } catch (confirmationError) {
      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: {
          state: "error",
          message: confirmationError instanceof Error ? confirmationError.message : "The proposal could not be applied.",
        },
      }));
    }
  };

  // ==========================================
  // 1. COLLAPSED FLOATING LAUNCHER (Bottom-Right)
  // ==========================================
  if (displayMode === "collapsed") {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setDisplayMode("drawer")}
          className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 border border-primary/20 ring-4 ring-primary/10"
          title={`Open ${copilotName} (⌘J)`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Bot className="h-4 w-4" />
          <span className="max-w-36 truncate tracking-tight">{copilotName}</span>
          <span className="hidden sm:inline text-[10px] opacity-75 font-mono bg-primary-foreground/20 px-1 py-0.5 rounded">
            ⌘J
          </span>
        </button>
      </div>
    );
  }

  // ========================================================
  // 2. EXPANDED COMMAND CENTER MODAL (Option A Full View)
  // ========================================================
  if (displayMode === "center") {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in-0 duration-200">
        <div className="flex h-[min(90vh,60rem)] max-h-[90vh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Command className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  WoPhoto AI Command Center
                </h3>
                <p className="text-xs text-muted-foreground">
                  Studio omnibar, tool orchestration & deep semantic search
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisplayMode("drawer")}
                className="gap-1.5 text-xs rounded-lg"
                title="Dock to bottom-right corner"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dock to Corner</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDisplayMode("collapsed")}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Close (Esc)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages & Tool Traces Body */}
          <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6">
            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
              <MessageScroller>
                <MessageScrollerViewport className="pr-2">
                  <MessageScrollerContent>
                    {messages.map((m) => (
                      <MessageScrollerItem
                        key={m.id}
                        messageId={m.id}
                        scrollAnchor={m.role === "user"}
                      >
                        <Message align={m.role === "user" ? "end" : "start"}>
                          <MessageContent>
                            <MessageHeader>
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                {m.role === "user" ? "You" : copilotName}
                              </span>
                            </MessageHeader>

                            {/* Tool Invocations via shadcn Trace */}
                            {getToolInvocations(m).length > 0 && (
                              <Trace className="mb-2">
                                {getToolInvocations(m).map((toolCall) => {
                                  const isDone = toolCall.state === "result";
                                  const result = isDone ? toolCall.result : null;

                                  return (
                                    <Collapsible key={toolCall.toolCallId} className="w-full">
                                      <CollapsibleTrigger className="w-full text-left">
                                        <TraceLine status={isDone ? undefined : "running"}>
                                          <TraceIcon>
                                            <Wrench className="size-3.5 text-primary" />
                                          </TraceIcon>
                                          <TraceTitle>
                                            <span className="font-mono text-xs">
                                              {toolCall.toolName}
                                            </span>
                                            {isDone && (
                                              <span className="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                                                (Completed)
                                              </span>
                                            )}
                                          </TraceTitle>
                                        </TraceLine>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-1 pl-6 text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded-lg">
                                        <div className="space-y-1">
                                          <div>Input: {JSON.stringify(toolCall.args)}</div>
                                          {isDone && (
                                            <div>Result: {JSON.stringify(result)}</div>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </Trace>
                            )}

                            {/* Message Text */}
                            {getMessageText(m) && (
                              <div
                                className={`rounded-xl p-3 text-xs leading-relaxed ${
                                  m.role === "user"
                                    ? "bg-primary text-primary-foreground font-medium self-end"
                                    : "bg-muted/40 border border-border text-foreground"
                                }`}
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                  {getMessageText(m)}
                                </ReactMarkdown>
                              </div>
                            )}

                            {/* Render Structured Proposal Cards from Tool Results */}
                            {getToolInvocations(m).map((ti) => {
                              if (ti.state === "result" && ti.result && typeof ti.result === "object") {
                                const res = ti.result as Record<string, unknown>;

                                // Deep navigation links
                                if (res.href && typeof res.href === "string") {
                                  return (
                                    <div
                                      key={`link-${ti.toolCallId}`}
                                      className="mt-2 p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3 text-xs"
                                    >
                                      <span className="text-foreground font-medium">
                                        {(res.message as string) || "Navigation Target Ready"}
                                      </span>
                                      <Link
                                        href={res.href}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                                      >
                                        <span>Jump</span>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Link>
                                    </div>
                                  );
                                }

                                // State-changing confirmation proposal
                                if (res.requiresConfirmation) {
                                  const proposalId = ti.toolCallId;
                                  const status = proposalStatus[proposalId];
                                  const proposalType = typeof res.proposalType === "string" ? res.proposalType : "";
                                  const payload = res.payload;
                                  const isApplying = status?.state === "applying";
                                  const isConfirmed = status?.state === "success";

                                  return (
                                    <div
                                      key={`prop-${proposalId}`}
                                      className="mt-2 p-4 rounded-xl border border-border bg-card space-y-3 text-xs"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-foreground">
                                            Action Proposal
                                          </span>
                                          <h4 className="text-xs font-semibold text-foreground mt-1">
                                            {(res.title as string) || "Pending Action"}
                                          </h4>
                                          <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {(res.description as string) || ""}
                                          </p>
                                        </div>

                                        <Button
                                          size="sm"
                                          onClick={() => handleConfirmProposal(proposalId, proposalType, payload)}
                                          disabled={isApplying || isConfirmed || !proposalType || !payload}
                                          className="text-xs font-semibold gap-1.5 h-8 shrink-0"
                                        >
                                          {isApplying ? (
                                            <span>Applying…</span>
                                          ) : isConfirmed ? (
                                            <>
                                              <Check className="h-3 w-3 text-emerald-400" />
                                              <span>Confirmed</span>
                                            </>
                                          ) : (
                                            <>
                                              <Play className="h-3 w-3 fill-current" />
                                              <span>Confirm & Apply</span>
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      {status && (
                                        <p className={`text-[11px] ${isConfirmed ? "text-emerald-600 dark:text-emerald-400" : isApplying ? "text-muted-foreground" : "text-destructive"}`}>
                                          {status.message}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}

                    {isLoading && (
                      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground animate-pulse">
                        <Bot className="h-4 w-4 animate-spin text-primary" />
                        <span>Copilot is reasoning and running studio tools...</span>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{error.message || "Failed to process AI request."}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reload()}
                          className="h-7 text-xs"
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* Keep the command input anchored below the conversation. */}
          <div className="shrink-0 border-t border-border bg-background p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={commandInputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ask Copilot to find reviews, create projects, or balance capacity..."
                className="pl-11 pr-24 h-12 text-sm bg-muted/20 border-border rounded-xl"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 h-8 text-xs font-semibold gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Execute</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. FLOATING CORNER DRAWER (Bottom-Right Floating Widget / Popover)
  // =========================================================================
  return (
    <aside className="fixed bottom-6 right-6 z-40 w-[92vw] sm:w-105 h-145 max-h-[85vh] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
      {/* Top Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate">
                {copilotName}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Autonomous Agent & Smart Search
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayMode("center")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Expand to Command Center (⌘K)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayMode("collapsed")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Minimize (⌘J)"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetChat}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Reset conversation"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayMode("collapsed")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-hidden p-3.5">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport className="pr-1.5">
              <MessageScrollerContent>
                {messages.map((m) => (
                  <MessageScrollerItem
                    key={m.id}
                    messageId={m.id}
                    scrollAnchor={m.role === "user"}
                  >
                    <Message align={m.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        {/* Tool Invocations via shadcn Trace */}
                        {getToolInvocations(m).length > 0 && (
                          <Trace className="mb-1.5">
                            {getToolInvocations(m).map((toolCall) => {
                              const isDone = toolCall.state === "result";

                              return (
                                <TraceLine
                                  key={toolCall.toolCallId}
                                  status={isDone ? undefined : "running"}
                                >
                                  <TraceIcon>
                                    <Wrench className="size-3 text-primary" />
                                  </TraceIcon>
                                  <TraceTitle>
                                    <span className="font-mono text-[11px]">
                                      {toolCall.toolName}
                                    </span>
                                  </TraceTitle>
                                </TraceLine>
                              );
                            })}
                          </Trace>
                        )}

                        {/* Content text */}
                        {getMessageText(m) && (
                          <div
                            className={`rounded-2xl p-3 text-xs leading-relaxed ${
                              m.role === "user"
                                ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                                : "bg-muted/40 border border-border text-foreground rounded-tl-xs"
                            }`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {getMessageText(m)}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Direct Jump Link or Confirmation Proposal */}
                        {getToolInvocations(m).map((ti) => {
                          if (ti.state === "result" && ti.result && typeof ti.result === "object") {
                            const res = ti.result as Record<string, unknown>;

                            // Deep navigation link card
                            if (res.href && typeof res.href === "string") {
                              return (
                                <div
                                  key={`link-${ti.toolCallId}`}
                                  className="mt-1.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-[11px] font-medium text-foreground truncate">
                                    {(res.message as string) || "Navigate"}
                                  </span>
                                  <Link
                                    href={res.href}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-[11px] hover:bg-primary/90 transition-colors shadow-xs shrink-0"
                                  >
                                    <span>Jump</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              );
                            }

                            // Confirmation proposal
                            if (res.requiresConfirmation) {
                              const proposalId = ti.toolCallId;
                              const status = proposalStatus[proposalId];
                              const proposalType = typeof res.proposalType === "string" ? res.proposalType : "";
                              const payload = res.payload;
                              const isApplying = status?.state === "applying";
                              const isConfirmed = status?.state === "success";

                              return (
                                <div
                                  key={`prop-${proposalId}`}
                                  className="mt-1.5 p-3 rounded-xl border border-border bg-card space-y-2 text-xs"
                                >
                                  <div>
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-foreground">
                                      Proposal
                                    </span>
                                    <h5 className="text-xs font-semibold text-foreground mt-1">
                                      {(res.title as string) || "Pending Action"}
                                    </h5>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {(res.description as string) || ""}
                                    </p>
                                  </div>

                                  <Button
                                    size="sm"
                                    disabled={isApplying || isConfirmed || !proposalType || !payload}
                                    onClick={() => handleConfirmProposal(proposalId, proposalType, payload)}
                                    className="w-full text-xs font-semibold gap-1.5 h-7 rounded-lg"
                                  >
                                    {isApplying ? (
                                      <span>Applying…</span>
                                    ) : isConfirmed ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-400" />
                                        <span>Confirmed</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="h-3 w-3 fill-current" />
                                        <span>Confirm & Apply</span>
                                      </>
                                    )}
                                  </Button>
                                  {status && (
                                    <p className={`text-[10px] ${isConfirmed ? "text-emerald-600 dark:text-emerald-400" : isApplying ? "text-muted-foreground" : "text-destructive"}`}>
                                      {status.message}
                                    </p>
                                  )}
                                </div>
                              );
                            }
                          }
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground animate-pulse">
                    <Bot className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Copilot running tools...</span>
                  </div>
                )}

                {error && (
                  <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs flex items-center justify-between gap-1.5">
                    <span className="text-[11px] truncate">{error.message || "Request failed"}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reload()}
                      className="h-6 px-2 text-[10px]"
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      {/* Bottom Input Form */}
      <div className="p-3 border-t border-border bg-background">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Copilot (e.g. 'Find Elena's review')..."
            className="pr-10 h-10 text-xs bg-muted/20 border-border rounded-xl"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="absolute right-1 h-8 w-8 p-0 rounded-lg shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
