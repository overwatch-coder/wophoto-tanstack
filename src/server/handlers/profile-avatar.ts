import { get } from "@vercel/blob"
import { UserStatus } from "@/generated/prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { avatarUserIdSchema } from "@/lib/validation/api"

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const session = await auth()
  const viewerId = session?.user?.id

  if (!viewerId) return new Response("Unauthorized", { status: 401 })

  const { userId: rawUserId } = params
  const parsedUserId = avatarUserIdSchema.safeParse(rawUserId)
  if (!parsedUserId.success) return new Response("Not found", { status: 404 })
  const userId = parsedUserId.data
  const target = await prisma.user.findUnique({
    where: { id: userId, status: UserStatus.ACTIVE },
    select: { id: true, image: true },
  })

  if (!target?.image) return new Response("Not found", { status: 404 })

  if (viewerId !== target.id) {
    const sharesWorkspace = await prisma.project.findFirst({
      where: {
        OR: [
          { managerId: viewerId },
          { clientId: viewerId },
          { tasks: { some: { assignees: { some: { userId: viewerId } } } } },
        ],
        tasks: { some: { assignees: { some: { userId: target.id } } } },
      },
      select: { id: true },
    })

    if (!sharesWorkspace) {
      const invitedByViewer = await prisma.invitation.findFirst({
        where: { invitedById: viewerId, acceptedUserId: target.id },
        select: { id: true },
      })

      if (!invitedByViewer) return new Response("Not found", { status: 404 })
    }
  }

  let imageUrl: URL
  try {
    imageUrl = new URL(target.image)
  } catch {
    return new Response("Not found", { status: 404 })
  }

  if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password || imageUrl.port) {
    return new Response("Not found", { status: 404 })
  }

  const isPrivateVercelBlob = imageUrl.hostname.endsWith(".private.blob.vercel-storage.com")
  const isGoogleProfileImage =
    imageUrl.hostname === "googleusercontent.com" ||
    imageUrl.hostname.endsWith(".googleusercontent.com")

  if (isGoogleProfileImage) {
    try {
      const response = await fetch(target.image, {
        redirect: "error",
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" },
        signal: AbortSignal.timeout(8_000),
      })
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
      const contentLength = Number(response.headers.get("content-length") || 0)
      if (
        !response.ok ||
        !contentType?.startsWith("image/") ||
        contentLength > 5 * 1024 * 1024 ||
        !response.body
      ) {
        return new Response("Not found", { status: 404 })
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        },
      })
    } catch (error) {
      console.error("Google profile picture read failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      })
      return new Response("Profile picture unavailable", { status: 502 })
    }
  }

  if (!isPrivateVercelBlob || !imageUrl.pathname.startsWith(`/profile/${target.id}/avatar`)) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const blob = await get(target.image, { access: "private" })
    if (!blob || blob.statusCode !== 200) {
      return new Response("Not found", { status: 404 })
    }

    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
      },
    })
  } catch (error) {
    console.error("Private profile picture read failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    })
    return new Response("Profile picture unavailable", { status: 502 })
  }
}
