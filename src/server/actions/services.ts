import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";
import { parseInput } from "@/lib/validation/common";
import { createStudioServiceSchema, deleteStudioServiceSchema, setStudioServiceActiveSchema, updateStudioServiceSchema } from "@/lib/validation/services";

export type StudioServiceActionState = { error?: string; success?: string };
const revalidateServices = () => (() => {})();
const getMessage = (error: unknown) => error instanceof Error ? error.message : "The service could not be saved.";

async function createStudioServiceServerImplementation(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
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

async function updateStudioServiceServerImplementation(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
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

async function setStudioServiceActiveServerImplementation(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
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

async function deleteStudioServiceServerImplementation(_state: StudioServiceActionState, formData: FormData): Promise<StudioServiceActionState> {
  try {
    const { context } = await requireStudioOwner();
    const input = parseInput(deleteStudioServiceSchema, {
      id: formData.get("id") ?? "",
    });
    const deleted = await prisma.$transaction(async (tx) => {
      const service = await tx.studioService.findFirst({
        where: { id: input.id, studioId: context.studioId },
        select: { id: true },
      });
      if (!service) return false;

      await tx.taskService.deleteMany({ where: { serviceId: service.id } });
      await tx.studioService.deleteMany({
        where: { id: service.id, studioId: context.studioId },
      });
      return true;
    });
    if (!deleted) return { error: "That service is no longer available." };
    revalidateServices();
    return { success: "Service deleted. Existing tasks remain without this service." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "This service is still in use and could not be deleted. Archive it instead." };
    }
    return { error: getMessage(error) };
  }
}


const createStudioServiceServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createStudioServiceServerImplementation>>) => args)
  .handler(async ({ data }) => createStudioServiceServerImplementation(...decodeActionArguments<Parameters<typeof createStudioServiceServerImplementation>>(data)));
export const createStudioService = async (...args: Parameters<typeof createStudioServiceServerImplementation>) => createStudioServiceServerFunction({ data: await encodeActionArguments(args) });

const updateStudioServiceServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateStudioServiceServerImplementation>>) => args)
  .handler(async ({ data }) => updateStudioServiceServerImplementation(...decodeActionArguments<Parameters<typeof updateStudioServiceServerImplementation>>(data)));
export const updateStudioService = async (...args: Parameters<typeof updateStudioServiceServerImplementation>) => updateStudioServiceServerFunction({ data: await encodeActionArguments(args) });

const setStudioServiceActiveServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof setStudioServiceActiveServerImplementation>>) => args)
  .handler(async ({ data }) => setStudioServiceActiveServerImplementation(...decodeActionArguments<Parameters<typeof setStudioServiceActiveServerImplementation>>(data)));
export const setStudioServiceActive = async (...args: Parameters<typeof setStudioServiceActiveServerImplementation>) => setStudioServiceActiveServerFunction({ data: await encodeActionArguments(args) });


const deleteStudioServiceServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof deleteStudioServiceServerImplementation>>) => args)
  .handler(async ({ data }) => deleteStudioServiceServerImplementation(...decodeActionArguments<Parameters<typeof deleteStudioServiceServerImplementation>>(data)));
export const deleteStudioService = async (...args: Parameters<typeof deleteStudioServiceServerImplementation>) => deleteStudioServiceServerFunction({ data: await encodeActionArguments(args) });
