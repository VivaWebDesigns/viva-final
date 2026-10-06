import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SearchArea {
  name: string;
  type: "City" | "County" | "DMA Region" | "State";
}

const TYPE_LABELS: Record<SearchArea["type"], string> = { City: "city", County: "county", "DMA Region": "metro area", State: "state" };

/** "Charlotte, NC,United States" → "Charlotte, NC" */
export function areaLabel(locationName: string) {
  return locationName.replace(/,United States$/, "").split(",").map(part => part.trim()).filter(Boolean).join(", ");
}

/** Picks the Google Ads location volumes are pulled for: a city, county, metro area or state. */
export default function SearchAreaPicker({ value, placeholder, onSelect, disabled }: {
  value: string;
  placeholder: string;
  onSelect: (locationName: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useQuery<{ areas: SearchArea[] }>({
    queryKey: [`/api/keyword-research/locations?q=${encodeURIComponent(debounced)}`],
    enabled: open && debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal sm:w-80" disabled={disabled} data-testid="button-kr-search-area">
          <span className="truncate">{value ? areaLabel(value) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Type a city, county or metro…" data-testid="input-kr-search-area" />
          <CommandList>
            {debounced.length < 2 ? (
              <p className="px-3 py-4 text-sm text-gray-500">Type at least 2 letters, e.g. "Charlotte" or "Union County".</p>
            ) : isFetching && !data ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            ) : (
              <>
                <CommandEmpty>No matching locations.</CommandEmpty>
                {data?.areas.map(area => (
                  <CommandItem key={area.name} value={area.name} onSelect={() => { onSelect(area.name); setOpen(false); setQuery(""); }}>
                    <span className="flex-1 truncate">{areaLabel(area.name)}</span>
                    <span className="ml-2 shrink-0 text-xs text-gray-500">{TYPE_LABELS[area.type]}</span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
