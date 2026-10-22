"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type ProfileActionState = {
  error?: string;
  success?: string;
};

export async function updateProfileName(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  const submittedName = formData.get("name");

  if (typeof submittedName !== "string") {
    return { error: "Enter your name." };
  }

  const name = submittedName.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) {
    return { error: "Your name must be between 1 and 80 characters." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { success: "Your name has been updated." };
}

export async function updateProfilePicture(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choose a profile picture to upload." };
  }
  if (photo.size > 1_500_000) {
    return { error: "Choose an image smaller than 1.5 MB." };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { error: "Profile picture uploads need BLOB_READ_WRITE_TOKEN in .env.local." };
  }

  const contentType = await getImageContentType(photo);
  if (!contentType || contentType !== photo.type) {
    return { error: "Choose a valid JPEG, PNG, or WebP image." };
  }

  let uploadedUrl: string | undefined;
  let stage: "blob-upload" | "profile-update" = "blob-upload";
  try {
    const blob = await put(`profile/${user.id}/avatar`, photo, {
      access: "private",
      addRandomSuffix: true,
      contentType,
    });
    uploadedUrl = blob.url;

    stage = "profile-update";
    const previousImage = user.image;
    await prisma.user.update({ where: { id: user.id }, data: { image: blob.url } });

    if (previousImage && isWoPhotoAvatar(previousImage, user.id)) {
      await del(previousImage).catch(() => undefined);
    }
  } catch (error) {
    if (uploadedUrl) await del(uploadedUrl).catch(() => undefined);
    console.error("Profile picture update failed", {
      stage,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      error:
        stage === "blob-upload"
          ? "The image could not be uploaded. Check the Blob storage configuration and try again."
          : "The image uploaded, but your profile could not be updated. Please try again.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: "Your profile picture has been updated." };
}

async function getImageContentType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  if (isPng && file.type === "image/png") return "image/png";
  if (isJpeg && file.type === "image/jpeg") return "image/jpeg";
  if (isWebp && file.type === "image/webp") return "image/webp";
  return null;
}

function isWoPhotoAvatar(image: string | null | undefined, userId: string) {
  if (!image) return false;

  try {
    const url = new URL(image);
    return (
      (url.hostname.endsWith(".private.blob.vercel-storage.com") ||
        url.hostname.endsWith(".public.blob.vercel-storage.com")) &&
      url.pathname.startsWith(`/profile/${userId}/avatar`)
    );
  } catch {
    return false;
  }
}
