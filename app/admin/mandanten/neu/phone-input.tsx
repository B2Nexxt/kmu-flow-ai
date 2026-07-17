"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  TELEFON_VORWAHN_OPTIONS,
  type TelefonVorwahlOption,
} from "./mandanten-onboarding-context";

const inputClassName =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function getInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20`
    : `${inputClassName} border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10`;
}

type PhoneInputProps = {
  id: string;
  label: string;
  vorwahl: string;
  nummer: string;
  onVorwahlChange: (value: string) => void;
  onNummerChange: (value: string) => void;
  hasError?: boolean;
  errorMessage?: string;
  placeholder?: string;
  onChange?: () => void;
  disabled?: boolean;
};

export function PhoneInput({
  id,
  label,
  vorwahl,
  nummer,
  onVorwahlChange,
  onNummerChange,
  hasError = false,
  errorMessage,
  placeholder = "z. B. 30 12345678",
  onChange,
  disabled = false,
}: PhoneInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    TELEFON_VORWAHN_OPTIONS.find((option) => option.dialCode === vorwahl) ??
    TELEFON_VORWAHN_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function selectOption(option: TelefonVorwahlOption) {
    onVorwahlChange(option.dialCode);
    onChange?.();
    setIsOpen(false);
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <div ref={containerRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            onClick={() => {
              if (disabled) return;
              setIsOpen((open) => !open);
            }}
            disabled={disabled}
            className={`inline-flex h-[42px] min-w-[7.5rem] items-center gap-1.5 rounded-lg border bg-white px-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-950 dark:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 ${
              hasError
                ? "border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-500/20"
                : "border-zinc-200 focus:border-zinc-400 focus:ring-zinc-900/10 dark:border-zinc-700 dark:focus:border-zinc-600 dark:focus:ring-zinc-50/10"
            }`}
          >
            <span aria-hidden="true">{selectedOption.flag}</span>
            <span className="font-medium">{selectedOption.dialCode}</span>
            <span
              aria-hidden="true"
              className="ml-auto text-xs text-zinc-400 dark:text-zinc-500"
            >
              ▾
            </span>
          </button>

          {isOpen && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute left-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {TELEFON_VORWAHN_OPTIONS.map((option) => (
                <li key={option.code} role="option" aria-selected={option.dialCode === vorwahl}>
                  <button
                    type="button"
                    onClick={() => selectOption(option)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      option.dialCode === vorwahl
                        ? "bg-zinc-50 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span aria-hidden="true">{option.flag}</span>
                    <span className="flex-1">{option.label}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {option.dialCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          id={id}
          name={id}
          type="tel"
          value={nummer}
          onChange={(e) => {
            if (disabled) return;
            onNummerChange(e.target.value);
            onChange?.();
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={`${getInputClassName(hasError)} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </div>
      {errorMessage && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
