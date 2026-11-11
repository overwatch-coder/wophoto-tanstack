import { useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { getProfileImageSrc } from "@/lib/profile-image";

type ProfileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  image: string | null | undefined;
  userId: string;
  fallback: ReactNode;
};

export function ProfileImage({ image, userId, fallback, alt = "", ...props }: ProfileImageProps) {
  const src = getProfileImageSrc(image, userId);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) return fallback;

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
    />
  );
}
