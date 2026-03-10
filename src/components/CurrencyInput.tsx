import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function formatCurrency(value: number): string {
  if (!value && value !== 0) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(raw: string): number {
  // Remove everything except digits and comma/dot
  const cleaned = raw.replace(/[^\d,]/g, "");
  if (!cleaned) return 0;
  // Replace comma with dot for parsing
  const normalized = cleaned.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "R$ 0,00",
  disabled = false,
  className,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync display when not focused
  React.useEffect(() => {
    if (!isFocused) {
      if (value) {
        setDisplayValue(`R$ ${formatCurrency(value)}`);
      } else {
        setDisplayValue("");
      }
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing
    if (value) {
      setDisplayValue(formatCurrency(value));
    } else {
      setDisplayValue("");
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrency(displayValue);
    onValueChange(parsed);
    if (parsed) {
      setDisplayValue(`R$ ${formatCurrency(parsed)}`);
    } else {
      setDisplayValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    // Live update the numeric value
    const parsed = parseCurrency(raw);
    onValueChange(parsed);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
    />
  );
}
