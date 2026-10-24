import { z } from "zod";

export const profileNameSchema = z.object({
  name: z.string().trim().transform((value) => value.replace(/\s+/g, " ")).refine((value) => value.length >= 1 && value.length <= 80, "Your name must be between 1 and 80 characters."),
});

export const profilePictureMetadataSchema = z.object({
  photo: z.instanceof(File).refine((file) => file.size > 0, "Choose a profile picture to upload.").refine((file) => file.size <= 1_500_000, "Choose an image smaller than 1.5 MB.").refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Choose a valid JPEG, PNG, or WebP image."),
});
