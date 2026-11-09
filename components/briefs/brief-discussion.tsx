import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postBriefQuestion, resolveBriefQuestion } from "@/src/server/actions/briefs";
import { getProfileImageSrc } from "@/lib/profile-image";
import {
  MessageSquare,
  CornerDownRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  RotateCcw,
} from "lucide-react";

export interface BriefQuestionItem {
  id: string;
  briefVersion: number;
  content: string;
  isResolved: boolean;
  isBlocker: boolean;
  parentId: string | null;
  createdAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  };
  replies?: BriefQuestionItem[];
}

interface BriefDiscussionProps {
  briefId: string;
  currentUserId: string;
  isManager: boolean;
  questions: BriefQuestionItem[];
  onRefresh?: () => void;
}

export function BriefDiscussion({
  briefId,
  currentUserId,
  isManager,
  questions,
  onRefresh,
}: BriefDiscussionProps) {
  const [content, setContent] = useState("");
  const [isBlocker, setIsBlocker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    const res = await postBriefQuestion({
      briefId,
      content: content.trim(),
      isBlocker,
    });
    setIsSubmitting(false);

    if (res.success) {
      setContent("");
      setIsBlocker(false);
      onRefresh?.();
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmittingReply(true);
    const res = await postBriefQuestion({
      briefId,
      content: replyContent.trim(),
      parentId,
    });
    setIsSubmittingReply(false);

    if (res.success) {
      setReplyContent("");
      setReplyingToId(null);
      onRefresh?.();
    }
  };

  const handleToggleResolve = async (
    questionId: string,
    currentResolved: boolean
  ) => {
    setActionLoadingId(questionId);
    await resolveBriefQuestion({
      questionId,
      isResolved: !currentResolved,
    });
    setActionLoadingId(null);
    onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">
            Crew Discussion & Questions ({questions.length})
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          Visible to assigned crew only (hidden from client)
        </span>
      </div>

      {/* New Question Form */}
      <form onSubmit={handlePostQuestion} className="space-y-3 p-3.5 border rounded-lg bg-card">
        <Textarea
          placeholder="Ask a clarifying question regarding shot list, props, lighting, or deliverables..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          className="text-xs"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={isBlocker}
              onChange={(e) => setIsBlocker(e.target.checked)}
              className="h-3.5 w-3.5 rounded border"
            />
            <span className={isBlocker ? "font-semibold text-destructive flex items-center gap-1" : "flex items-center gap-1"}>
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Flag as production blocker (pauses approval)
            </span>
          </label>

          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isSubmitting}
            className="flex items-center gap-1.5 h-8 text-xs"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post Question
          </Button>
        </div>
      </form>

      {/* Questions list */}
      <div className="space-y-4">
        {questions.map((q) => {
          const authorAvatar = getProfileImageSrc(q.author.image, q.author.id);
          const canResolve = isManager || q.author.id === currentUserId;

          return (
            <div
              key={q.id}
              className={`p-3.5 rounded-lg border bg-card space-y-3 ${
                q.isBlocker && !q.isResolved
                  ? "border-destructive/40 bg-destructive/5"
                  : ""
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-7 w-7 rounded-full overflow-hidden bg-muted border flex items-center justify-center text-xs font-semibold">
                    {authorAvatar ? (
                      <img
                        src={authorAvatar}
                        alt={q.author.name || "User"}
                        className="size-full object-cover"
                      />
                    ) : (
                      q.author.name?.charAt(0) || "U"
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {q.author.name || q.author.email}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase font-mono">
                        {q.author.role}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        v{q.briefVersion}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {q.isBlocker && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/15 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Blocker
                    </span>
                  )}
                  {q.isResolved ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Resolved
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Question Text */}
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap pl-9">
                {q.content}
              </p>

              {/* Action buttons */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pl-9 border-t pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setReplyingToId(replyingToId === q.id ? null : q.id)
                  }
                  className="h-6 px-2 text-xs flex items-center gap-1"
                >
                  <CornerDownRight className="h-3 w-3" />
                  Reply
                </Button>

                {canResolve && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={actionLoadingId === q.id}
                    onClick={() => handleToggleResolve(q.id, q.isResolved)}
                    className="h-6 px-2 text-xs flex items-center gap-1"
                  >
                    {actionLoadingId === q.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : q.isResolved ? (
                      <>
                        <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Mark Resolved
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Threaded direct replies */}
              {Array.isArray(q.replies) && q.replies.length > 0 && (
                <div className="space-y-2 pl-9 pt-1">
                  {q.replies.map((r) => {
                    const replyAvatar = getProfileImageSrc(
                      r.author.image,
                      r.author.id
                    );
                    return (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-md bg-muted/40 border space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="relative h-5 w-5 rounded-full overflow-hidden bg-muted border flex items-center justify-center text-[10px]">
                              {replyAvatar ? (
                                <img
                                  src={replyAvatar}
                                  alt={r.author.name || "User"}
                                  className="size-full object-cover"
                                />
                              ) : (
                                r.author.name?.charAt(0) || "U"
                              )}
                            </div>
                            <span className="font-medium text-xs">
                              {r.author.name || r.author.email}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase font-mono">
                              {r.author.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-foreground pl-7 whitespace-pre-wrap">
                          {r.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply Form (if open) */}
              {replyingToId === q.id && (
                <div className="pl-9 pt-2 space-y-2">
                  <Textarea
                    placeholder="Write a direct reply or official clarification..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyingToId(null);
                        setReplyContent("");
                      }}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!replyContent.trim() || isSubmittingReply}
                      onClick={() => handlePostReply(q.id)}
                      className="h-7 text-xs flex items-center gap-1"
                    >
                      {isSubmittingReply && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      Post Reply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {questions.length === 0 && (
          <div className="text-center py-6 border border-dashed rounded-lg text-xs text-muted-foreground">
            No questions asked yet. Use the form above to ask for creative direction or lighting clarification.
          </div>
        )}
      </div>
    </div>
  );
}
