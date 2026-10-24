import { z } from "zod";
import { idSchema } from "./common";

export const avatarUserIdSchema = idSchema;
export const cronAuthorizationSchema = z.string().max(4096).regex(/^Bearer [A-Za-z0-9._~-]+$/, "Unauthorized.");
