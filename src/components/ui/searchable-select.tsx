import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Buscar...",
  allLabel = "Todas",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label className="text-xs text-muted-foreground">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "h-9 w-full rounded border border-border bg-secondary px-3 text-sm text-left flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-ring",
            open && "ring-2 ring-ring"
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || allLabel}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded border border-border bg-card shadow-lg">
            <div className="relative border-b border-border p-2">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded bg-secondary pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              <li
                onClick={() => select("")}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm hover:bg-accent",
                  !value && "font-medium text-primary"
                )}
              >
                {allLabel}
              </li>
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
              ) : (
                filtered.map((o) => (
                  <li
                    key={o}
                    onClick={() => select(o)}
                    className={cn(
                      "cursor-pointer px-3 py-1.5 text-sm hover:bg-accent",
                      value === o && "font-medium text-primary"
                    )}
                  >
                    {o}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
