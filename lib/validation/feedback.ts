import { z } from "zod";
import { FeedbackType } from "@/generated/prisma/client";
import { idSchema, optionalIdSchema } from "./common";

const feedbackTypeSchema = z.enum(FeedbackType).catch(FeedbackType.REVISION);
const scoreSchema = z.union([
  z.null(),
  z.undefined(),
  z.literal(""),
  z.string().regex(/^\d+$/, "Choose a rating from 1 to 5 stars for your review.").transform(Number),
  z.number(),
]).transform((val) => (val === "" || val === null ? undefined : val)).optional();
const detailsSchema = z.string().trim().min(5, "Request details must be between 5 and 5,000 characters.").max(5000, "Request details must be between 5 and 5,000 characters.");
const titleSchema = z.string().trim().max(150, "Request title must be between 3 and 150 characters.");

const clientFeedbackFields = {
  projectId: z.string().trim().min(1, "Please choose a campaign or project."),
  taskId: optionalIdSchema.optional().transform((value) => value ?? null),
  type: feedbackTypeSchema,
  score: scoreSchema,
  title: titleSchema,
  details: detailsSchema,
};

export const createClientFeedbackSchema = z.object(clientFeedbackFields).superRefine((value, context) => {
  if (value.type === FeedbackType.REVIEW) {
    if (!Number.isInteger(value.score) || (value.score ?? 0) < 1 || (value.score ?? 0) > 5) {
      context.addIssue({ code: "custom", path: ["score"], message: "Choose a rating from 1 to 5 stars for your review." });
    }
  } else if (value.title.length < 3) {
    context.addIssue({ code: "custom", path: ["title"], message: "Request title must be between 3 and 150 characters." });
  }
});

export const updateClientFeedbackSchema = z.object({
  ...clientFeedbackFields,
  feedbackId: idSchema,
}).superRefine((value, context) => {
  if (value.type === FeedbackType.REVIEW) {
    if (!Number.isInteger(value.score) || (value.score ?? 0) < 1 || (value.score ?? 0) > 5) {
      context.addIssue({ code: "custom", path: ["score"], message: "Choose a rating from 1 to 5 stars for your review." });
    }
  } else if (value.title.length < 3) {
    context.addIssue({ code: "custom", path: ["title"], message: "Request title must be between 3 and 150 characters." });
  }
});

export const feedbackResolutionSchema = z.object({
  feedbackId: idSchema,
  responseNote: z.string().trim().min(3, "Resolution note must be between 3 and 5,000 characters.").max(5000, "Resolution note must be between 3 and 5,000 characters."),
});

export const feedbackDelegationSchema = z.object({
  feedbackId: idSchema,
  workerId: z.string().trim().min(1, "Please choose a worker to delegate this revision to."),
  delegationNote: z.string().trim().min(1, "Please provide instructions for the worker.").max(5000, "Delegation instructions must be between 3 and 5,000 characters."),
});

export const workerRevisionSchema = z.object({
  feedbackId: idSchema,
  workerNote: z.string().trim().min(3, "Submission note must be between 3 and 5,000 characters.").max(5000, "Submission note must be between 3 and 5,000 characters."),
});

export const deleteFeedbackSchema = idSchema;
