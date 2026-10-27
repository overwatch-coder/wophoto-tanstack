"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";
import { parseInput } from "@/lib/validation/common";
import { createStudioServiceSchema, setStudioServiceActiveSchema, updateStudioServiceSchema } from "@/lib/validation/services";

export type StudioServiceActionState = { error?: string; success?: string };
const servicePaths = ["/manager/services", "/manager", "/manager/tasks"];
const revalidateServices = () => servicePaths.forEach((path) => revalidatePath(path));
const getMessage = (error: unknown) => error instanceof Error ? error.message : "The service could not be saved.";

export async function createStudioService(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
  try {
    const { context } = await requireStudioOwner();
    const input = parseInput(createStudioServiceSchema, {
      name: formData.get("name") ?? "",
      description: formData.get("description") ?? "",
    });
    await prisma.studioService.create({ data: { ...input, studioId: context.studioId } });
    revalidateServices();
    return { success: `Created ${input.name}.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A service with that name already exists." };
    return { error: getMessage(error) };
  }
}

export async function updateStudioService(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
  try {
    const { context } = await requireStudioOwner();
    const input = parseInput(updateStudioServiceSchema, {
      id: formData.get("id") ?? "",
      name: formData.get("name") ?? "",
      description: formData.get("description") ?? "",
    });
    const result = await prisma.studioService.updateMany({
      where: { id: input.id, studioId: context.studioId },
      data: { name: input.name, description: input.description },
    });
    if (!result.count) return { error: "That service is no longer available." };
    revalidateServices();
    return { success: "Service updated." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A service with that name already exists." };
    return { error: getMessage(error) };
  }
}

export async function setStudioServiceActive(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
  try {
    const { context } = await requireStudioOwner();
    const input = parseInput(setStudioServiceActiveSchema, {
      id: formData.get("id") ?? "",
      isActive: formData.get("isActive") === "true",
    });
    const result = await prisma.studioService.updateMany({
      where: { id: input.id, studioId: context.studioId },
      data: { isActive: input.isActive },
    });
    if (!result.count) return { error: "That service is no longer available." };
    revalidateServices();
    return { success: input.isActive ? "Service restored." : "Service archived. Existing tasks keep this service." };
  } catch (error) {
    return { error: getMessage(error) };
  }
}
