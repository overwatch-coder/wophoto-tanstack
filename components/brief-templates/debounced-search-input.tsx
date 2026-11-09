
import { useEffect, useState } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { Input } from "@/components/ui/input";

interface DebouncedSearchInputProps {
  value: string;
  onSearch: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function DebouncedSearchInput({
  value,
  onSearch,
  placeholder,
  className,
}: DebouncedSearchInputProps) {
  const [input, setInput] = useState(value);
  const debouncedInput = useDebounce(input, 350);

  useEffect(() => {
    const next = debouncedInput.trim();
    if (next !== value) onSearch(next);
  }, [debouncedInput, onSearch, value]);

  return (
    <Input
      value={input}
      onChange={(event) => setInput(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
