"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z"
      />
    </svg>
  );
}

interface PrototypeGoogleButtonProps {
  className?: string;
  size?: "default" | "lg";
}

export function PrototypeGoogleButton({
  className = "",
  size = "lg",
}: PrototypeGoogleButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
    }, 1200);
  };

  const heightClass = size === "lg" ? "h-11 px-5" : "h-10 px-4";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      className={`group relative flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card text-foreground font-medium text-sm transition-all duration-150 hover:bg-muted/80 hover:border-foreground/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-70 disabled:pointer-events-none shadow-xs ${heightClass} ${className}`}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleMark />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
}
