"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { FileUp } from "lucide-react";

interface FileDropzoneProps {
  accept: string;
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  name?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

export function FileDropzone({
  accept,
  onFiles,
  multiple = false,
  name,
  inputRef,
  disabled = false,
  title = "Drop files here, or browse",
  description = "Choose files from your device or drag them into this area.",
  className,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputElementRef = useRef<HTMLInputElement>(null);

  const receiveFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (selected.length) onFiles(multiple ? selected : selected.slice(0, 1));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) receiveFiles(event.currentTarget.files);
    if (!name) event.currentTarget.value = "";
  };

  const onDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled || !event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) {
      if (name && inputElementRef.current) {
        const transfer = new DataTransfer();
        for (const file of Array.from(event.dataTransfer.files).slice(0, 1)) {
          transfer.items.add(file);
        }
        inputElementRef.current.files = transfer.files;
      }
      receiveFiles(event.dataTransfer.files);
    }
  };

  return (
    <label
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-dragging={dragging || undefined}
      className={`group flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 data-[dragging]:border-primary data-[dragging]:bg-primary/10 data-[dragging]:ring-2 data-[dragging]:ring-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${className || ""}`}
      aria-disabled={disabled}
    >
      <input
        type="file"
        name={name}
        ref={(node) => {
          inputElementRef.current = node;
          if (inputRef) inputRef.current = node;
        }}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
        tabIndex={disabled ? -1 : 0}
      />
      <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-primary">
        <FileUp className="size-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-foreground">
        {dragging ? "Drop files to add them" : title}
      </span>
      <span className="max-w-prose text-xs leading-relaxed text-muted-foreground">
        {description}
      </span>
    </label>
  );
}
