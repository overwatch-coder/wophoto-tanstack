import { useState, useTransition, type FormEvent } from "react";
import { signOutUser } from "@/src/server/actions/auth";

export function useLogout() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await signOutUser();
        window.location.replace("/login");
      } catch {
        setError("We couldn't log you out. Check your connection and try again.");
      }
    });
  };

  return { error, handleSubmit, isPending };
}
