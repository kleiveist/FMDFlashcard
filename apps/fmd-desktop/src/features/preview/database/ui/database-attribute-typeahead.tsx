/**
 * @file apps/fmd-desktop/src/features/preview/database/ui/database-attribute-typeahead.tsx
 *
 * Shared attribute typeahead input for database panels.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DatabaseVaultAttributeSuggestion,
} from "../database-types";

type DatabaseAttributeTypeaheadProps = {
  value: string;
  suggestions: DatabaseVaultAttributeSuggestion[];
  onValueChange: (nextValue: string) => void;
  placeholder?: string;
  strictSelection?: boolean;
  disabled?: boolean;
  noResultsLabel?: string;
};

const toNormalized = (value: string) => value.trim().toLowerCase();

const sortForDisplay = (suggestions: DatabaseVaultAttributeSuggestion[]) =>
  [...suggestions].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }
    return left.key.localeCompare(right.key, undefined, { sensitivity: "base" });
  });

const rankSuggestions = (
  suggestions: DatabaseVaultAttributeSuggestion[],
  rawQuery: string,
) => {
  const query = toNormalized(rawQuery);
  if (!query) {
    return sortForDisplay(suggestions);
  }

  const prefixMatches: DatabaseVaultAttributeSuggestion[] = [];
  const substringMatches: DatabaseVaultAttributeSuggestion[] = [];

  suggestions.forEach((suggestion) => {
    const candidate = suggestion.normalizedKey;
    if (!candidate.includes(query)) {
      return;
    }
    if (candidate.startsWith(query)) {
      prefixMatches.push(suggestion);
      return;
    }
    substringMatches.push(suggestion);
  });

  return [
    ...sortForDisplay(prefixMatches),
    ...sortForDisplay(substringMatches),
  ];
};

export const DatabaseAttributeTypeahead = ({
  value,
  suggestions,
  onValueChange,
  placeholder,
  strictSelection = false,
  disabled = false,
  noResultsLabel = "Keine passenden Attribute gefunden",
}: DatabaseAttributeTypeaheadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen || !strictSelection) {
      setQuery(value);
    }
  }, [isOpen, strictSelection, value]);

  const ranked = useMemo(
    () => rankSuggestions(suggestions, strictSelection ? query : value),
    [query, strictSelection, suggestions, value],
  );

  const displayValue = strictSelection && isOpen ? query : value;

  const close = () => {
    setIsOpen(false);
    setQuery(value);
  };

  const selectSuggestion = (nextValue: string) => {
    onValueChange(nextValue);
    setQuery(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="database-attribute-typeahead">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        onFocus={() => {
          setIsOpen(true);
          setQuery(value);
        }}
        onClick={() => {
          setIsOpen(true);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setIsOpen(true);
          if (!strictSelection) {
            onValueChange(next);
          }
        }}
        onBlur={() => {
          if (!strictSelection) {
            close();
            return;
          }

          const normalized = toNormalized(query);
          const exact = suggestions.find((entry) => entry.normalizedKey === normalized) ?? null;
          if (exact) {
            onValueChange(exact.key);
            setQuery(exact.key);
          }
          close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            inputRef.current?.blur();
            return;
          }

          if (event.key === "Enter") {
            if (strictSelection) {
              event.preventDefault();
              const next = ranked[0]?.key;
              if (next) {
                selectSuggestion(next);
              }
            } else {
              onValueChange(query);
              close();
            }
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {isOpen ? (
        <div className="database-attribute-typeahead-dropdown" role="listbox">
          {ranked.length === 0 ? (
            <p className="database-attribute-typeahead-empty">{noResultsLabel}</p>
          ) : (
            <ul className="database-attribute-typeahead-list">
              {ranked.map((suggestion) => (
                <li key={suggestion.normalizedKey}>
                  <button
                    type="button"
                    className="database-attribute-typeahead-option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectSuggestion(suggestion.key);
                    }}
                  >
                    <span>{suggestion.key}</span>
                    <span className="database-attribute-typeahead-count">{suggestion.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
