export function getProfileImageSrc(image: string | null | undefined, userId: string) {
  if (!image) return null;

  try {
    const url = new URL(image);
    const isPrivateVercelBlob = url.hostname.endsWith(".private.blob.vercel-storage.com");
    const isGoogleProfileImage =
      url.hostname === "googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com");
    if (url.protocol === "https:" && (isPrivateVercelBlob || isGoogleProfileImage)) {
      return `/api/profile/avatar/${encodeURIComponent(userId)}`;
    }
  } catch {
    // Keep local preview URLs such as blob: URLs unchanged.
  }

  return image;
}
