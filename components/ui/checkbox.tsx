
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "cn";

interface CheckboxProps {
  id?: string;
  name?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id,
  name,
  checked,
  onCheckedChange,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      name={name}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "group inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border-2 border-muted-foreground/70 bg-background text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
