"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OrganizationSelectOption } from "@/lib/angebote/get-organization-select-options";

type OrganizationSelectProps = {
  options: OrganizationSelectOption[];
  value: string;
  onChange: (organizationId: string) => void;
  error?: string;
  disabled?: boolean;
};

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

export function OrganizationSelect({
  options,
  value,
  onChange,
  error,
  disabled = false,
}: OrganizationSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOrganization = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [option.firmenname, option.ort ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSelect(organizationId: string) {
    onChange(organizationId);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={`${listboxId}-search`}
        className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Mandant
      </label>

      <input
        id={`${listboxId}-search`}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={isOpen ? search : (selectedOrganization?.firmenname ?? "")}
        placeholder="Mandant suchen oder auswählen …"
        disabled={disabled}
        className={getInputClassName(!!error)}
        onFocus={() => {
          if (disabled) return;
          setIsOpen(true);
          setSearch(selectedOrganization?.firmenname ?? "");
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
      />

      {isOpen && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              Keine Treffer
            </li>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option.id === value;

              return (
                <li key={option.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                      isSelected
                        ? "bg-zinc-50 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(option.id)}
                  >
                    <span>{option.firmenname}</span>
                    {option.ort && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {option.ort}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
