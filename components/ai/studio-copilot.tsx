import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { createClientFeedback } from "@/src/server/actions/feedback";
import { createWorkRequest, type WorkRequestActionState } from "@/src/server/actions/work-requests";
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
  Paperclip,
  Square,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  UploadCloud,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type ChatAttachment,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_BATCH_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/ai/attachment-types";
import { setClientFeedbackDraft, type ClientFeedbackDraft } from "@/lib/client-feedback-draft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TraceDescription,
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

function getShortcutModifier() {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "⌘" : "Ctrl+";
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
  return message.parts.flatMap((part) => {
    const value = part as unknown as Record<string, unknown>;
    const type = typeof value.type === "string" ? value.type : "";
    const toolName = type === "dynamic-tool"
      ? (typeof value.toolName === "string" ? value.toolName : "")
      : type.startsWith("tool-") ? type.slice(5) : "";
    if (!toolName || typeof value.toolCallId !== "string") return [];
    const state = value.state === "output-available" || value.state === "output-error" ? "result" : "call";
    return [{
      toolCallId: value.toolCallId,
      toolName,
      args: value.input,
      result: value.output ?? (typeof value.errorText === "string" ? { error: value.errorText } : undefined),
      state,
    }];
  });
}

function getCopilotActivity(message: UIMessage): string | null {
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (part?.type !== "data-copilot-activity") continue;
    const data = (part as { data?: unknown }).data;
    if (data && typeof data === "object" && "label" in data && typeof data.label === "string") return data.label;
  }
  return null;
}

function getMessageAttachments(message: UIMessage) {
  return message.parts.flatMap((part) => part.type === "file"
    ? [{ url: part.url, contentType: part.mediaType, name: part.filename ?? "Attachment" }]
    : []);
}

function getToolProgressLabel(toolName: string, rawArgs: unknown): string {
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs as Record<string, unknown> : {};
  if (toolName === "query_studio_data") {
    const entityLabels: Record<string, string> = {
      PROJECTS: "projects",
      TASKS: "tasks",
      DELETED_TASKS: "deleted tasks",
      FEEDBACK: "client feedback",
      NOTIFICATIONS: "notifications",
      COMMENTS: "comments",
      RATINGS: "ratings",
      INVITATIONS: "invitations",
      TEAM: "team members",
      INVENTORY: "inventory items",
      INVENTORY_LOANS: "inventory loans",
      INVENTORY_MAINTENANCE: "inventory maintenance records",
    };
    const entity = typeof args.entity === "string" ? entityLabels[args.entity] : undefined;
    const operation = typeof args.operation === "string" ? args.operation : "LIST";
    if (!entity) return "Checking studio records";
    if (operation === "COUNT") return `Counting ${entity}`;
    if (operation === "GET") return `Opening ${entity} details`;
    return `Checking ${entity}`;
  }

  const labels: Record<string, string> = {
    smart_search: "Searching studio records",
    query_team_capacity: "Checking team capacity",
    query_sla_risks: "Reviewing upcoming deadlines",
    create_project: "Preparing project setup",
    create_task_batch: "Preparing task assignments",
    create_invitation: "Preparing client invitation",
    prepare_client_feedback: "Drafting your review",
    prepare_inventory_action: "Preparing inventory change",
    generate_wrapup_report: "Preparing a delivery summary",
    navigate_to: "Finding the right workspace page",
  };
  return labels[toolName] ?? "Working on your request";
}

function getMessageText(message: UIMessage) {
  return message.parts?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") ?? "";
}

function parseUserMessageContent(content: string) {
  const parts = content.split(/--- ATTACHED FILE: (.*?) ---/g);
  if (parts.length <= 1) {
    return { displayText: content, attachedFileNames: [] };
  }

  const displayText = parts[0].trim();
  const attachedFileNames: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const rawName = parts[i]?.trim();
    if (rawName && !attachedFileNames.includes(rawName)) {
      attachedFileNames.push(rawName);
    }
  }
  return { displayText, attachedFileNames };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskProposalPreview({ value, compact = false }: { value: unknown; compact?: boolean }) {
  if (!Array.isArray(value)) return null;
  const rows = value.filter((row): row is {
    title: string;
    assigneeName: string;
    dueDate: string | null;
  } => Boolean(
    row && typeof row === "object" &&
    typeof row.title === "string" &&
    typeof row.assigneeName === "string" &&
    (row.dueDate === null || typeof row.dueDate === "string")
  ));
  if (rows.length === 0) return null;

  return (
    <div className={`max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {rows.map((row, index) => (
        <div key={`${row.title}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2.5 py-2">
          <span className="min-w-0 truncate font-medium text-foreground" title={row.title}>{row.title}</span>
          <span className="text-right text-muted-foreground">{row.dueDate || "No due date"}</span>
          <span className="col-span-2 truncate text-muted-foreground" title={row.assigneeName}>Assigned to {row.assigneeName}</span>
        </div>
      ))}
    </div>
  );
}

function InventoryProposalPreview({ value, compact = false }: { value: unknown; compact?: boolean }) {
  if (!value || typeof value !== "object") return null;
  const preview = value as { title?: unknown; values?: unknown };
  const values = Array.isArray(preview.values) ? preview.values.filter((row): row is { label: string; value: string } =>
    Boolean(row && typeof row === "object" && typeof row.label === "string" && typeof row.value === "string"),
  ) : [];
  if (values.length === 0) return null;
  return (
    <dl className={`grid gap-x-4 gap-y-1.5 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {typeof preview.title === "string" && <div className="sm:col-span-2 font-medium text-foreground">{preview.title}</div>}
      {values.map((row) => <div key={`${row.label}-${row.value}`} className="min-w-0"><dt className="text-muted-foreground">{row.label}</dt><dd className="break-words font-medium text-foreground">{row.value}</dd></div>)}
    </dl>
  );
}

function getAttachmentIcon(name: string, isImage: boolean) {
  if (isImage) return <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  }
  return <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
}

function RenderMessageBody({ message }: { message: UIMessage }) {
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const rawText = getMessageText(message);
  const { displayText, attachedFileNames } = parseUserMessageContent(rawText);
  const attachments = getMessageAttachments(message);

  return (
    <>
    <div className="space-y-2">
      {/* Attached Images or files */}
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => {
            const isImg =
              att.url?.startsWith("data:image/") ||
              att.contentType?.startsWith("image/");
            if (isImg) {
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setPreviewImage({ url: att.url, name: att.name || "Attached image" })}
                  aria-label={`Preview ${att.name || "attached image"}`}
                  className="group relative max-h-40 max-w-56 overflow-hidden rounded-lg border border-border/60 bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img
                    src={att.url}
                    alt={att.name || "Attached image"}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </button>
              );
            }
            return (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/80 border border-border text-[11px]"
              >
                {getAttachmentIcon(att.name || "file", false)}
                <span className="truncate max-w-40 font-medium">
                  {att.name || "Attachment"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted Document Markers */}
      {attachedFileNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachedFileNames.map((fileName, idx) => (
            <div
              key={idx}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                message.role === "user"
                  ? "bg-primary-foreground/15 border-primary-foreground/20 text-primary-foreground"
                  : "bg-muted border-border text-foreground"
              }`}
            >
              {getAttachmentIcon(fileName, false)}
              <span className="truncate max-w-48">{fileName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Text */}
      {displayText && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayText}
        </ReactMarkdown>
      )}
    </div>
    <Dialog open={Boolean(previewImage)} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
      <DialogContent className="max-h-[92vh] w-auto max-w-[calc(100vw-2rem)] border-border bg-background p-3 sm:max-w-[min(92vw,72rem)]">
        <DialogTitle className="sr-only">{previewImage?.name || "Image preview"}</DialogTitle>
        <DialogDescription className="sr-only">Full size preview of the image attached to this message.</DialogDescription>
        {previewImage && (
          <img src={previewImage.url} alt={previewImage.name} className="max-h-[80vh] max-w-full rounded-md object-contain" />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function AttachmentChips({
  attachments,
  onRemove,
  onClear,
}: {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
      <span className="mr-0.5 text-[10px] text-muted-foreground">{attachments.length}/{MAX_ATTACHMENTS_PER_MESSAGE}</span>
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-xs shadow-2xs animate-in fade-in-0 duration-150"
        >
          {getAttachmentIcon(att.name, att.isImage)}
          <span className="truncate font-medium text-[11px] text-foreground max-w-36">
            {att.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatFileSize(att.size)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="text-muted-foreground hover:text-foreground ml-0.5 p-0.5 rounded hover:bg-background/60 transition-colors"
            title="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onClear} className="rounded px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          Clear all
      </button>
    </div>
  );
}

export function StudioCopilot({ initialMode = "collapsed", copilotName = "WoPhoto Studio Copilot" }: StudioCopilotProps) {
  const router = useRouter();
  const [displayMode, setDisplayMode] = useState<"collapsed" | "drawer" | "center">(initialMode);
  const [shortcutModifier, setShortcutModifier] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<Record<string, {
    state: "applying" | "success" | "error";
    message: string;
    invitePath?: string;
    copied?: boolean;
  }>>({});
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandFileInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    regenerate,
    stop,
  } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
      {
        id: "welcome-msg",
        role: "assistant",
        parts: [{ type: "text", text: `Hello, I am ${copilotName}. I can search reviews, create tasks, inspect retoucher capacity, or flag SLA deadlines. How can I assist you today?` }],
      },
    ],
  });
  const isLoading = status === "submitted" || status === "streaming";
  const latestMessage = messages[messages.length - 1];
  const activeAssistantMessageId = latestMessage?.role === "assistant" ? latestMessage.id : null;
  const hasAssistantProgress = activeAssistantMessageId !== null &&
    (getCopilotActivity(latestMessage) !== null || getToolInvocations(latestMessage).length > 0);

  useEffect(() => {
    setShortcutModifier(getShortcutModifier());
  }, []);

  const handleFileUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    if (isUploadingAttachment) return;
    if (pendingAttachments.length + files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setUploadError(`Attach no more than ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
      return;
    }
    const currentSize = pendingAttachments.reduce((total, attachment) => total + attachment.size, 0);
    const incomingSize = files.reduce((total, file) => total + file.size, 0);
    if (currentSize + incomingSize > MAX_ATTACHMENT_BATCH_SIZE_BYTES) {
      setUploadError("The total attachment size per message cannot exceed 20MB.");
      return;
    }
    setIsUploadingAttachment(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const f of files) {
        if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
          throw new Error(
            `File "${f.name}" exceeds the 10MB maximum limit (${(f.size / (1024 * 1024)).toFixed(1)}MB).`
          );
        }
        formData.append("files", f);
      }

      const res = await fetch("/api/chat/attachments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file attachment.");
      }

      if (data.attachments && Array.isArray(data.attachments)) {
        setPendingAttachments((prev) => [...prev, ...data.attachments]);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to process attachment."
      );
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (commandFileInputRef.current) commandFileInputRef.current.value = "";
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const clearPendingAttachments = () => setPendingAttachments([]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (
      (!input.trim() && pendingAttachments.length === 0) ||
      isLoading ||
      isUploadingAttachment
    ) {
      return;
    }

    const currentInput = input.trim();
    const currentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setInput("");

    const imageAttachments = currentAttachments.filter((att) => att.isImage && att.dataUrl);
    const docAttachments = currentAttachments.filter((att) => !att.isImage && att.extractedText);

    let fullContent =
      currentInput || (currentAttachments.length > 0 ? "Please analyze the attached file(s)." : "");

    if (docAttachments.length > 0) {
      const docTexts = docAttachments
        .map(
          (doc) =>
            `\n\n--- ATTACHED FILE: ${doc.name.replace(/[\r\n]/g, " ")} ---\n${doc.extractedText}\n--- END OF ATTACHED FILE ---`
        )
        .join("");
      fullContent += docTexts;
    }

    try {
      await sendMessage({
        text: fullContent,
        files: imageAttachments.map((img) => ({
          type: "file" as const,
          filename: img.name,
          mediaType: img.type,
          url: img.dataUrl!,
        })),
      });
    } catch (sendErr) {
      console.error("Failed to append chat message:", sendErr);
      setPendingAttachments(currentAttachments);
      setInput(currentInput);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  // Focus input when opening drawer or center
  useEffect(() => {
    if (displayMode === "drawer") {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else if (displayMode === "center") {
      setTimeout(() => commandInputRef.current?.focus(), 150);
    }
  }, [displayMode]);

  // Use the operating system's native modifier for the Copilot shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierPressed = getShortcutModifier() === "⌘" ? e.metaKey : e.ctrlKey;
      if (modifierPressed && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setDisplayMode((prev) => (prev === "collapsed" ? "drawer" : "collapsed"));
      } else if (modifierPressed && e.key.toLowerCase() === "k") {
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
        parts: [{ type: "text", text: "Chat session refreshed. How can I help you?" }],
      },
    ]);
  };

  const handleOpenClientFeedbackDraft = (draft: ClientFeedbackDraft) => {
    setClientFeedbackDraft(draft);
    router.navigate({ href: "/client/project-feedback?newFeedback=1" });
  };

  const handleSubmitClientReviewDraft = async (proposalId: string, draft: ClientFeedbackDraft) => {
    const existingStatus = proposalStatus[proposalId];
    if (existingStatus?.state === "applying" || existingStatus?.state === "success") return;

    setProposalStatus((prev) => ({
      ...prev,
      [proposalId]: { state: "applying", message: "Submitting review…" },
    }));

    try {
      const formData = new FormData();
      formData.set("projectId", draft.projectId);
      formData.set("taskId", "");
      formData.set("type", "REVIEW");
      formData.set("score", String(draft.score));
      formData.set("title", "Project review");
      formData.set("details", draft.details);

      const result = await createClientFeedback({}, formData);
      if (result.error) throw new Error(result.error);

      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: {
          state: "success",
          message: result.success ?? "Review submitted successfully.",
        },
      }));
      router.invalidate();
    } catch (submitError) {
      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: {
          state: "error",
          message: submitError instanceof Error ? submitError.message : "Could not submit the review. Please try again.",
        },
      }));
    }
  };

  const handleSubmitClientWorkRequestDraft = async (
    proposalId: string,
    draft: { type: "WORK" | "PROJECT"; projectId: string | null; title: string; details: string; requestedDueAt: string | null },
  ) => {
    if (proposalStatus[proposalId]?.state === "applying" || proposalStatus[proposalId]?.state === "success") return;
    setProposalStatus((previous) => ({ ...previous, [proposalId]: { state: "applying", message: "Submitting request…" } }));
    try {
      const formData = new FormData();
      formData.set("type", draft.type);
      formData.set("projectId", draft.projectId ?? "");
      formData.set("title", draft.title);
      formData.set("details", draft.details);
      formData.set("requestedDueAt", draft.requestedDueAt ?? "");
      const result: WorkRequestActionState = await createWorkRequest({}, formData);
      if (result.error) throw new Error(result.error);
      setProposalStatus((previous) => ({ ...previous, [proposalId]: { state: "success", message: result.success ?? "Request submitted." } }));
      router.invalidate();
    } catch (submitError) {
      setProposalStatus((previous) => ({ ...previous, [proposalId]: { state: "error", message: submitError instanceof Error ? submitError.message : "Could not submit the request. Please try again." } }));
    }
  };

  const handleCopyInvitationLink = async (proposalId: string, invitePath: string) => {
    const inviteUrl = new URL(invitePath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: { ...prev[proposalId], state: "success", message: "Invitation link copied.", invitePath, copied: true },
      }));
    } catch {
      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: { ...prev[proposalId], state: "success", message: "Copy failed. Select the link above and copy it manually.", invitePath, copied: false },
      }));
    }
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
      const result = (await response.json()) as { error?: string; message?: string; invitePath?: string };
      if (!response.ok) throw new Error(result.error || "The proposal could not be applied.");
      setProposalStatus((prev) => ({
        ...prev,
        [proposalId]: {
          state: "success",
          message: result.message || "Applied successfully.",
          invitePath: result.invitePath,
        },
      }));
      if (proposalType === "CREATE_PROJECT" || proposalType === "CREATE_TASK_BATCH" || proposalType === "CREATE_DAILY_ENTRY" || proposalType === "INVENTORY_ACTION") {
        router.invalidate();
      }
      if (proposalType === "CREATE_INVITATION") router.invalidate();
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
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setDisplayMode("drawer")}
          aria-label={`Open ${copilotName}`}
          className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary p-0 text-xs font-semibold text-primary-foreground shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:px-3.5 sm:py-2.5 ring-4 ring-primary/10"
          title={shortcutModifier ? `Open ${copilotName} (${shortcutModifier}J)` : `Open ${copilotName}`}
        >
          <span className="relative hidden h-2 w-2 sm:flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Bot className="h-4 w-4" />
          <span className="hidden max-w-36 truncate tracking-tight sm:inline">{copilotName}</span>
          <span className="hidden sm:inline text-[10px] opacity-75 font-mono bg-primary-foreground/20 px-1 py-0.5 rounded">
            {shortcutModifier ? `${shortcutModifier}J` : " "}
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
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex h-[min(90vh,60rem)] max-h-[90vh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 relative"
        >
          {isDraggingOver && (
            <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-xs border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center gap-2 p-6 text-center animate-in fade-in-0 duration-150">
              <UploadCloud className="h-10 w-10 text-primary animate-bounce" />
              <p className="text-sm font-semibold text-foreground">Drop files to attach</p>
              <p className="text-xs text-muted-foreground">
                Images, Excel (.xlsx, .csv), PDFs, Word (.docx) up to 10MB
              </p>
            </div>
          )}

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
                                            <span className="text-xs">
                                              {getToolProgressLabel(toolCall.toolName, toolCall.args)}
                                            </span>
                                          </TraceTitle>
                                          <TraceDescription>
                                            {isDone ? "Done" : "In progress"}
                                          </TraceDescription>
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

                            {isLoading && m.id === activeAssistantMessageId && getToolInvocations(m).every((toolCall) => toolCall.state === "result") && getCopilotActivity(m) && (
                              <Trace className="mb-2">
                                <TraceLine status="running">
                                  <TraceIcon><Bot className="size-3.5 text-primary" /></TraceIcon>
                                  <TraceTitle><span className="text-xs">{getCopilotActivity(m)}</span></TraceTitle>
                                  <TraceDescription>In progress</TraceDescription>
                                </TraceLine>
                              </Trace>
                            )}

                            {/* Message Text and Attachments */}
                            {(getMessageText(m) || getMessageAttachments(m).length > 0) && (
                              <div
                                className={`rounded-xl p-3 text-xs leading-relaxed ${
                                  m.role === "user"
                                    ? "bg-primary text-primary-foreground font-medium self-end"
                                    : "bg-muted/40 border border-border text-foreground"
                                }`}
                              >
                                <RenderMessageBody message={m} />
                              </div>
                            )}

                            {/* Render Structured Proposal Cards from Tool Results */}
                            {getToolInvocations(m).map((ti) => {
                              if (ti.state === "result" && ti.result && typeof ti.result === "object") {
                                const res = ti.result as Record<string, unknown>;

                                if (res.needsInput && typeof res.message === "string") {
                                  return <div key={`needs-input-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-foreground">{res.message}</div>;
                                }

                                if (res.clientFeedbackDraft && typeof res.clientFeedbackDraft === "object") {
                                  const draft = res.clientFeedbackDraft as {
                                    projectId: string;
                                    projectName: string;
                                    type: "REVIEW";
                                    score: number;
                                    details: string;
                                  };
                                  const draftStatus = proposalStatus[ti.toolCallId];
                                  const draftIsSubmitting = draftStatus?.state === "applying";
                                  const draftIsSubmitted = draftStatus?.state === "success";
                                  return (
                                    <div key={`feedback-draft-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-4 text-xs">
                                      <div className="font-semibold text-foreground">Review: {draft.projectName}</div>
                                      <div className="mt-1 text-muted-foreground">Rating: {"★".repeat(draft.score)}{"☆".repeat(5 - draft.score)} — {draft.score}/5</div>
                                      <p className="mt-2 whitespace-pre-wrap text-foreground">{draft.details}</p>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={draftIsSubmitting || draftIsSubmitted}
                                          onClick={() => void handleSubmitClientReviewDraft(ti.toolCallId, draft)}
                                        >
                                          {draftIsSubmitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : draftIsSubmitted ? <Check className="mr-1.5 size-3.5" /> : null}
                                          {draftIsSubmitting ? "Submitting…" : draftIsSubmitted ? "Submitted" : "Submit review"}
                                        </Button>
                                        {!draftIsSubmitted && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={draftIsSubmitting}
                                            onClick={() => handleOpenClientFeedbackDraft(draft)}
                                          >
                                            Edit in form
                                          </Button>
                                        )}
                                      </div>
                                      {draftStatus?.message && (
                                        <p className={`mt-2 break-words ${draftStatus.state === "error" ? "text-destructive" : draftStatus.state === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                          {draftStatus.message}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }

                                if (res.workRequestDraft && typeof res.workRequestDraft === "object") {
                                  const draft = res.workRequestDraft as { type: "WORK" | "PROJECT"; projectId: string | null; projectName: string | null; title: string; details: string; requestedDueAt: string | null };
                                  const status = proposalStatus[ti.toolCallId];
                                  const isSubmitting = status?.state === "applying";
                                  const isSubmitted = status?.state === "success";
                                  return (
                                    <div key={`work-request-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-4 text-xs">
                                      <p className="font-semibold text-foreground">{draft.type === "PROJECT" ? "New project request" : `Work request: ${draft.projectName ?? "Project"}`}</p>
                                      <p className="mt-2 font-medium text-foreground">{draft.title}</p>
                                      <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{draft.details}</p>
                                      {draft.requestedDueAt && <p className="mt-2 text-muted-foreground">Requested by {new Date(`${draft.requestedDueAt}T00:00:00`).toLocaleDateString()}</p>}
                                      <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={isSubmitting || isSubmitted} onClick={() => void handleSubmitClientWorkRequestDraft(ti.toolCallId, draft)}>{isSubmitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : isSubmitted ? <Check className="mr-1.5 size-3.5" /> : <Send className="mr-1.5 size-3.5" />}{isSubmitting ? "Submitting…" : isSubmitted ? "Submitted" : "Submit request"}</Button></div>
                                      {status?.message && <p className={`mt-2 break-words ${status.state === "error" ? "text-destructive" : status.state === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{status.message}</p>}
                                    </div>
                                  );
                                }

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
                                        to={res.href as any}
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
                                  const invitationPreview = res.invitationPreview && typeof res.invitationPreview === "object"
                                    ? res.invitationPreview as { email?: unknown; role?: unknown }
                                    : null;
                                  const dailyEntryPreview = res.dailyEntryPreview && typeof res.dailyEntryPreview === "object"
                                    ? res.dailyEntryPreview as { projectName?: unknown; title?: unknown; description?: unknown; workDate?: unknown }
                                    : null;
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
                                          {proposalType === "CREATE_INVITATION" && invitationPreview && (
                                            <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 px-3 py-2 text-[11px] sm:grid-cols-2">
                                              <div><dt className="text-muted-foreground">Recipient</dt><dd className="break-all font-medium text-foreground">{String(invitationPreview.email ?? "")}</dd></div>
                                              <div><dt className="text-muted-foreground">Role</dt><dd className="font-medium text-foreground">{invitationPreview.role === "CLIENT" ? "Client" : ""}</dd></div>
                                            </dl>
                                          )}
                                          {proposalType === "CREATE_DAILY_ENTRY" && dailyEntryPreview && (
                                            <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 px-3 py-2 text-[11px] sm:grid-cols-2">
                                              <div><dt className="text-muted-foreground">Project</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.projectName ?? "")}</dd></div>
                                              <div><dt className="text-muted-foreground">Work date</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.workDate ?? "")}</dd></div>
                                              <div className="sm:col-span-2"><dt className="text-muted-foreground">Work logged</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.title ?? "")}</dd></div>
                                              {typeof dailyEntryPreview.description === "string" && dailyEntryPreview.description && <div className="sm:col-span-2"><dt className="text-muted-foreground">Details</dt><dd className="whitespace-pre-wrap font-medium text-foreground">{dailyEntryPreview.description}</dd></div>}
                                            </dl>
                                          )}
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
                                              <span>{proposalType === "CREATE_INVITATION" ? "Create invitation" : proposalType === "CREATE_DAILY_ENTRY" ? "Save daily work" : "Confirm & Apply"}</span>
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      {res.proposalType === "CREATE_TASK_BATCH" && (
                                        <TaskProposalPreview value={res.preview} />
                                      )}
                                      {proposalType === "INVENTORY_ACTION" && (
                                        <InventoryProposalPreview value={res.inventoryPreview} />
                                      )}
                                      {status && (
                                        <p className={`text-[11px] ${isConfirmed ? "text-emerald-600 dark:text-emerald-400" : isApplying ? "text-muted-foreground" : "text-destructive"}`}>
                                          {status.message}
                                        </p>
                                      )}
                                      {status?.invitePath && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                                          <code className="min-w-0 flex-1 break-all text-[10px] text-foreground">{status.invitePath}</code>
                                          <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyInvitationLink(proposalId, status.invitePath!)} className="h-7 shrink-0 gap-1.5 text-[10px]">
                                            <Copy className="size-3" />{status.copied ? "Copied" : "Copy link"}
                                          </Button>
                                        </div>
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

                    {isLoading && !hasAssistantProgress && (
                      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground animate-pulse">
                        <Bot className="h-4 w-4 animate-spin text-primary" />
                        <span>Understanding your request…</span>
                      </div>
                    )}

                    {error && (
                      <div role="alert" className="flex min-w-0 flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {error.message || "Failed to process AI request."}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void regenerate()}
                          className="h-7 shrink-0 self-start text-xs"
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
            <AttachmentChips
              attachments={pendingAttachments}
              onRemove={removePendingAttachment}
              onClear={clearPendingAttachments}
            />
            {uploadError && (
              <div role="alert" className="mb-3 flex min-w-0 flex-col gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive sm:flex-row sm:items-start sm:justify-between">
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="shrink-0 self-start hover:opacity-75"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
              <input
                ref={commandFileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(Array.from(e.target.files));
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading || isUploadingAttachment}
                onClick={() => commandFileInputRef.current?.click()}
                className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
                title="Attach document or image (Max 10MB)"
              >
                {isUploadingAttachment ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <div className="relative flex-1 flex items-center">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={commandInputRef}
                  value={input}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  placeholder="Ask Copilot to find reviews, create projects, or balance capacity..."
                  className="pl-11 pr-24 h-12 text-sm bg-muted/20 border-border rounded-xl"
                />
                {isLoading ? (
                  <Button type="button" size="sm" onClick={stop} className="absolute right-2 h-8 gap-1.5 text-xs font-semibold" aria-label="Stop Copilot response">
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUploadingAttachment || (!input.trim() && pendingAttachments.length === 0)}
                    className="absolute right-2 h-8 text-xs font-semibold gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Execute</span>
                  </Button>
                )}
              </div>
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
    <aside
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed bottom-6 right-6 z-40 w-[92vw] sm:w-105 h-145 max-h-[85vh] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-xs border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center gap-2 p-6 text-center animate-in fade-in-0 duration-150">
          <UploadCloud className="h-8 w-8 text-primary animate-bounce" />
          <p className="text-xs font-semibold text-foreground">Drop files to attach</p>
          <p className="text-[10px] text-muted-foreground">
            Images, Excel (.xlsx, .csv), PDFs, Word (.docx) up to 10MB
          </p>
        </div>
      )}

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
            title={shortcutModifier ? `Expand to Command Center (${shortcutModifier}K)` : "Expand to Command Center"}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDisplayMode("collapsed")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={shortcutModifier ? `Minimize (${shortcutModifier}J)` : "Minimize"}
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
                                    <span className="text-[11px]">
                                      {getToolProgressLabel(toolCall.toolName, toolCall.args)}
                                    </span>
                                  </TraceTitle>
                                  <TraceDescription>
                                    {isDone ? "Done" : "In progress"}
                                  </TraceDescription>
                                </TraceLine>
                              );
                            })}
                          </Trace>
                        )}

                        {isLoading && m.id === activeAssistantMessageId && getToolInvocations(m).every((toolCall) => toolCall.state === "result") && getCopilotActivity(m) && (
                          <Trace className="mb-1.5">
                            <TraceLine status="running">
                              <TraceIcon><Bot className="size-3 text-primary" /></TraceIcon>
                              <TraceTitle><span className="text-[11px]">{getCopilotActivity(m)}</span></TraceTitle>
                              <TraceDescription>In progress</TraceDescription>
                            </TraceLine>
                          </Trace>
                        )}

                        {/* Text and Attachments */}
                        {(getMessageText(m) || getMessageAttachments(m).length > 0) && (
                          <div
                            className={`rounded-2xl p-3 text-xs leading-relaxed ${
                              m.role === "user"
                                ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                                : "bg-muted/40 border border-border text-foreground rounded-tl-xs"
                            }`}
                          >
                            <RenderMessageBody message={m} />
                          </div>
                        )}

                        {/* Direct Jump Link or Confirmation Proposal */}
                        {getToolInvocations(m).map((ti) => {
                          if (ti.state === "result" && ti.result && typeof ti.result === "object") {
                            const res = ti.result as Record<string, unknown>;

                            if (res.needsInput && typeof res.message === "string") {
                              return <div key={`needs-input-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-foreground">{res.message}</div>;
                            }

                            if (res.clientFeedbackDraft && typeof res.clientFeedbackDraft === "object") {
                              const draft = res.clientFeedbackDraft as {
                                projectId: string;
                                projectName: string;
                                type: "REVIEW";
                                score: number;
                                details: string;
                              };
                              const draftStatus = proposalStatus[ti.toolCallId];
                              const draftIsSubmitting = draftStatus?.state === "applying";
                              const draftIsSubmitted = draftStatus?.state === "success";
                              return (
                                <div key={`feedback-draft-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-4 text-xs">
                                  <div className="font-semibold text-foreground">Review: {draft.projectName}</div>
                                  <div className="mt-1 text-muted-foreground">Rating: {"★".repeat(draft.score)}{"☆".repeat(5 - draft.score)} — {draft.score}/5</div>
                                  <p className="mt-2 whitespace-pre-wrap text-foreground">{draft.details}</p>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={draftIsSubmitting || draftIsSubmitted}
                                      onClick={() => void handleSubmitClientReviewDraft(ti.toolCallId, draft)}
                                    >
                                      {draftIsSubmitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : draftIsSubmitted ? <Check className="mr-1.5 size-3.5" /> : null}
                                      {draftIsSubmitting ? "Submitting…" : draftIsSubmitted ? "Submitted" : "Submit review"}
                                    </Button>
                                    {!draftIsSubmitted && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={draftIsSubmitting}
                                        onClick={() => handleOpenClientFeedbackDraft(draft)}
                                      >
                                        Edit in form
                                      </Button>
                                    )}
                                  </div>
                                  {draftStatus?.message && (
                                    <p className={`mt-2 break-words ${draftStatus.state === "error" ? "text-destructive" : draftStatus.state === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                      {draftStatus.message}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            if (res.workRequestDraft && typeof res.workRequestDraft === "object") {
                              const draft = res.workRequestDraft as { type: "WORK" | "PROJECT"; projectId: string | null; projectName: string | null; title: string; details: string; requestedDueAt: string | null };
                              const status = proposalStatus[ti.toolCallId];
                              const isSubmitting = status?.state === "applying";
                              const isSubmitted = status?.state === "success";
                              return (
                                <div key={`work-request-${ti.toolCallId}`} className="mt-2 rounded-xl border border-border bg-card p-4 text-xs">
                                  <p className="font-semibold text-foreground">{draft.type === "PROJECT" ? "New project request" : `Work request: ${draft.projectName ?? "Project"}`}</p>
                                  <p className="mt-2 font-medium text-foreground">{draft.title}</p>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{draft.details}</p>
                                  {draft.requestedDueAt && <p className="mt-2 text-muted-foreground">Requested by {new Date(`${draft.requestedDueAt}T00:00:00`).toLocaleDateString()}</p>}
                                  <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={isSubmitting || isSubmitted} onClick={() => void handleSubmitClientWorkRequestDraft(ti.toolCallId, draft)}>{isSubmitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : isSubmitted ? <Check className="mr-1.5 size-3.5" /> : <Send className="mr-1.5 size-3.5" />}{isSubmitting ? "Submitting…" : isSubmitted ? "Submitted" : "Submit request"}</Button></div>
                                  {status?.message && <p className={`mt-2 break-words ${status.state === "error" ? "text-destructive" : status.state === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{status.message}</p>}
                                </div>
                              );
                            }

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
                                    to={res.href as any}
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
                              const invitationPreview = res.invitationPreview && typeof res.invitationPreview === "object"
                                ? res.invitationPreview as { email?: unknown; role?: unknown }
                                : null;
                              const dailyEntryPreview = res.dailyEntryPreview && typeof res.dailyEntryPreview === "object"
                                ? res.dailyEntryPreview as { projectName?: unknown; title?: unknown; description?: unknown; workDate?: unknown }
                                : null;
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
                                    {proposalType === "CREATE_INVITATION" && invitationPreview && (
                                      <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 px-2.5 py-2 text-[10px] sm:grid-cols-2">
                                        <div><dt className="text-muted-foreground">Recipient</dt><dd className="break-all font-medium text-foreground">{String(invitationPreview.email ?? "")}</dd></div>
                                        <div><dt className="text-muted-foreground">Role</dt><dd className="font-medium text-foreground">{invitationPreview.role === "CLIENT" ? "Client" : ""}</dd></div>
                                      </dl>
                                    )}
                                    {proposalType === "CREATE_DAILY_ENTRY" && dailyEntryPreview && (
                                      <dl className="mt-2 grid gap-1 rounded-lg bg-muted/50 px-3 py-2 text-[11px] sm:grid-cols-2">
                                        <div><dt className="text-muted-foreground">Project</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.projectName ?? "")}</dd></div>
                                        <div><dt className="text-muted-foreground">Work date</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.workDate ?? "")}</dd></div>
                                        <div className="sm:col-span-2"><dt className="text-muted-foreground">Work logged</dt><dd className="font-medium text-foreground">{String(dailyEntryPreview.title ?? "")}</dd></div>
                                        {typeof dailyEntryPreview.description === "string" && dailyEntryPreview.description && <div className="sm:col-span-2"><dt className="text-muted-foreground">Details</dt><dd className="whitespace-pre-wrap font-medium text-foreground">{dailyEntryPreview.description}</dd></div>}
                                      </dl>
                                    )}
                                  </div>

                                  {res.proposalType === "CREATE_TASK_BATCH" && (
                                    <TaskProposalPreview value={res.preview} compact />
                                  )}
                                  {proposalType === "INVENTORY_ACTION" && (
                                    <InventoryProposalPreview value={res.inventoryPreview} compact />
                                  )}

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
                                        <span>{proposalType === "CREATE_INVITATION" ? "Create invitation" : proposalType === "CREATE_DAILY_ENTRY" ? "Save daily work" : "Confirm & Apply"}</span>
                                      </>
                                    )}
                                  </Button>
                                  {status && (
                                    <p className={`text-[10px] ${isConfirmed ? "text-emerald-600 dark:text-emerald-400" : isApplying ? "text-muted-foreground" : "text-destructive"}`}>
                                      {status.message}
                                    </p>
                                  )}
                                  {status?.invitePath && (
                                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2">
                                      <code className="break-all text-[10px] text-foreground">{status.invitePath}</code>
                                      <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyInvitationLink(proposalId, status.invitePath!)} className="h-7 w-full gap-1.5 text-[10px]">
                                        <Copy className="size-3" />{status.copied ? "Copied" : "Copy link"}
                                      </Button>
                                    </div>
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

                {isLoading && !hasAssistantProgress && (
                  <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground animate-pulse">
                    <Bot className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Understanding your request…</span>
                  </div>
                )}

                {error && (
                  <div role="alert" className="flex min-w-0 flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive sm:flex-row sm:items-start sm:justify-between">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] [overflow-wrap:anywhere]">
                      {error.message || "Request failed"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void regenerate()}
                      className="h-6 shrink-0 self-start px-2 text-[10px]"
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
        <AttachmentChips
          attachments={pendingAttachments}
          onRemove={removePendingAttachment}
          onClear={clearPendingAttachments}
        />
        {uploadError && (
          <div role="alert" className="mb-2 flex min-w-0 flex-col gap-1.5 rounded-md bg-destructive/10 px-2 py-2 text-[11px] text-destructive sm:flex-row sm:items-start sm:justify-between">
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="hover:opacity-75 shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="relative flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFileUpload(Array.from(e.target.files));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLoading || isUploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg p-0"
            title="Attach document or image (Max 10MB)"
          >
            {isUploadingAttachment ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className="relative flex-1 flex items-center">
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask Copilot (e.g. 'Find Elena's review')..."
              className="pr-10 h-10 text-xs bg-muted/20 border-border rounded-xl"
            />
            {isLoading ? (
              <Button type="button" size="icon" onClick={stop} className="absolute right-1 h-8 w-8 rounded-lg" aria-label="Stop Copilot response" title="Stop response">
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={(!input.trim() && pendingAttachments.length === 0) || isUploadingAttachment}
                className="absolute right-1 h-8 w-8 p-0 rounded-lg shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}
