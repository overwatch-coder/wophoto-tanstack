"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, X } from "lucide-react";

import {
  updateProfileName,
  updateProfilePicture,
  type ProfileActionState,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfileImageSrc } from "@/lib/profile-image";

const initialState: ProfileActionState = {};

export function ProfileSettings({
  email,
  image,
  name,
  userId,
}: {
  email: string;
  image: string | null;
  name: string | null;
  userId: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="border-b pb-5 sm:pb-6">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Account</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Manage the name, photo, and sign-in account your team sees in WoPhoto.
        </p>
      </header>

      <div className="divide-y">
        <section aria-labelledby="profile-picture-heading" className="py-6 sm:py-8">
          <PictureForm image={image} name={name} userId={userId} />
        </section>

        <section aria-labelledby="display-name-heading" className="py-6 sm:py-8">
          <div className="mb-4">
            <h3 id="display-name-heading" className="font-medium">
              Display name
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your name is shown to your team in tasks, updates, and project activity.
            </p>
          </div>
          <NameForm name={name ?? ""} />
        </section>

        <section aria-labelledby="sign-in-heading" className="py-6 sm:py-8">
          <div className="mb-4">
            <h3 id="sign-in-heading" className="font-medium">
              Sign in
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              WoPhoto uses your invited Google account. Email and password sign in
              is not available.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-md border bg-card px-4 py-4 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <GoogleMark />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Google account</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
            <span className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-sm font-medium text-primary">
              <Check aria-hidden="true" className="size-4" />
              Connected
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateProfileName, initialState);

  return (
    <form
      action={formAction}
      className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={name}
          maxLength={80}
          required
          className="min-h-11"
        />
      </div>
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Saving…" : "Save name"}
      </Button>
      <div className="sm:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function PictureForm({
  image,
  name,
  userId,
}: {
  image: string | null;
  name: string | null;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfilePicture,
    initialState,
  );

  return (
    <PictureFormFields
      key={image ?? "no-profile-picture"}
      action={formAction}
      image={image}
      name={name}
      userId={userId}
      pending={pending}
      state={state}
    />
  );
}

function PictureFormFields({
  action,
  image,
  name,
  userId,
  pending,
  state,
}: {
  action: (formData: FormData) => void;
  image: string | null;
  name: string | null;
  userId: string;
  pending: boolean;
  state: ProfileActionState;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    const file = selectedFileRef.current;
    if (state.error && file && inputRef.current && !inputRef.current.files?.length) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
  }, [state]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function clearSelectedPhoto() {
    selectedFileRef.current = null;
    setSelectedFileName(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input
        ref={inputRef}
        id="profile-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a profile picture"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          selectedFileRef.current = file;
          setSelectedFileName(file?.name ?? null);
          setPreviewUrl(file ? URL.createObjectURL(file) : null);
        }}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProfilePhoto image={previewUrl ?? image} name={name} userId={userId} size={88} />
        <div className="min-w-0 flex-1">
          <h3 id="profile-picture-heading" className="font-medium">
            Profile picture
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This photo appears beside your name across the workspace.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            JPEG, PNG, or WebP, up to 1.5 MB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {selectedFileName ? "Choose another" : "Upload new picture"}
          </Button>
          {selectedFileName ? (
            <>
              <Button type="submit" disabled={pending} className="min-h-11">
                {pending ? "Uploading…" : "Save picture"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cancel picture selection"
                disabled={pending}
                className="min-h-11 min-w-11 px-3"
                onClick={clearSelectedPhoto}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {selectedFileName ? (
        <p className="pl-0 text-sm text-muted-foreground sm:pl-24" title={selectedFileName}>
          Selected: {selectedFileName}
        </p>
      ) : null}
      <div className="sm:pl-24">
        {state.error || !selectedFileName ? <ActionMessage state={state} /> : null}
        <span className="sr-only" aria-live="polite">
          {pending ? "Uploading profile picture" : ""}
        </span>
      </div>
    </form>
  );
}

function ProfilePhoto({
  image,
  name,
  userId,
  size,
}: {
  image: string | null;
  name: string | null;
  userId: string;
  size: number;
}) {
  const initials = name?.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-medium text-primary"
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image
          src={getProfileImageSrc(image, userId) ?? image}
          alt=""
          fill
          unoptimized
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

function ActionMessage({ state }: { state: ProfileActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.success}
      </p>
    );
  }

  return null;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z" />
    </svg>
  );
}
