export function getProfileImageSrc(image: string | null | undefined, userId: string) {
  if (!image) return null;

  try {
    const url = new URL(image);
    if (url.hostname.endsWith(".private.blob.vercel-storage.com")) {
      return `/api/profile/avatar/${encodeURIComponent(userId)}`;
    }
  } catch {
    // Keep local preview URLs such as blob: URLs unchanged.
  }

  return image;
}
