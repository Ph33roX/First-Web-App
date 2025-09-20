"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Suggestion = {
  symbol: string;
  shortname: string | null;
  longname: string | null;
  exchShortName: string | null;
};

export type SelectedTicker = {
  symbol: string;
  name: string | null;
  description: string | null;
};

export default function TickerAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = "Enter ticker...",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (t: SelectedTicker) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const debounced = useMemo(() => {
    let t: any;
    return (q: string) => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (!q) {
          setItems([]);
          setOpen(false);
          return;
        }
        setLoading(true);
        try {
          const url = `/api/tickers/search?q=${encodeURIComponent(q)}`;
          const res = await fetch(url, { cache: "no-store" });
          const data = await res.json();
          setItems(data.results || []);
          setOpen(true);
        } catch {
          setItems([]);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      }, 200);
    };
  }, []);

  useEffect(() => {
    debounced(value);
  }, [value, debounced]);

  async function handlePick(s: Suggestion) {
    onChange(s.symbol);
    setOpen(false);
    try {
      const res = await fetch(`/api/tickers/summary?symbol=${encodeURIComponent(s.symbol)}`, { cache: "no-store" });
      const d = await res.json();
      onSelect({
        symbol: d.symbol ?? s.symbol,
        name: d.longname || d.shortname || s.longname || s.shortname || null,
        description: d.description ?? null,
      });
    } catch {
      onSelect({
        symbol: s.symbol,
        name: s.longname || s.shortname || null,
        description: null,
      });
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded border px-3 py-2"
        onFocus={() => value && setOpen(true)}
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
        aria-controls={open ? listId : undefined}
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          id={listId}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded border bg-white shadow"
        >
          {items.map((s, idx) => {
            const name = s.longname || s.shortname || "";
            return (
              <li
                key={`${s.symbol}-${idx}`}
                role="option"
                aria-selected="false"
                tabIndex={0}
                onClick={() => handlePick(s)}
                onKeyDown={(e) => e.key === "Enter" && handlePick(s)}
                className="cursor-pointer px-3 py-2 hover:bg-gray-100"
              >
                <div className="font-mono">{s.symbol}</div>
                <div className="text-sm opacity-80">
                  {name}
                  {s.exchShortName ? ` · ${s.exchShortName}` : ""}
                </div>
              </li>
            );
          })}
          {loading && <li className="px-3 py-2 text-sm opacity-70">Loading…</li>}
        </ul>
      )}
    </div>
  );
}
