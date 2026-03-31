import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCitiesForState } from "@/lib/usCities";
import { cn } from "@/lib/utils";

interface CityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  stateCode: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export function CityCombobox({ value, onChange, stateCode, disabled, "data-testid": testId }: CityComboboxProps) {
  const [open, setOpen] = useState(false);

  const cities = useMemo(() => getCitiesForState(stateCode), [stateCode]);

  return (
    <Popover open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value || (disabled ? "Select state first" : "Select city...")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city..." />
          <CommandList>
            <CommandEmpty>No city found.</CommandEmpty>
            <CommandGroup>
              {cities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={() => {
                    onChange(city === value ? "" : city);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === city ? "opacity-100" : "opacity-0")}
                  />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
