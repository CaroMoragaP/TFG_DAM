import {
  isThemeSelectionLocked,
  MAX_BOOK_THEMES,
  normalizeThemeSelection,
  toggleThemeSelection,
} from "../lib/bookMetadata";

type ThemeSelectorProps = {
  error?: string;
  helperText?: string;
  onChange: (themes: string[]) => void;
  options: string[];
  selectedThemes: string[];
};

export function ThemeSelector({
  error,
  helperText,
  onChange,
  options,
  selectedThemes,
}: ThemeSelectorProps) {
  const normalizedSelection = normalizeThemeSelection(selectedThemes);
  const visibleOptions = Array.from(new Set([...normalizedSelection, ...options]));

  return (
    <div className="field-group field-span-full">
      <div className="theme-selector-header">
        <span>Temas</span>
        <span className="theme-selector-counter">
          {normalizedSelection.length}/{MAX_BOOK_THEMES} seleccionados
        </span>
      </div>

      <div className="theme-selector-grid" role="group" aria-label="Temas">
        {visibleOptions.map((theme) => {
          const isSelected = normalizedSelection.includes(theme);
          const isLocked = isThemeSelectionLocked(normalizedSelection, theme);

          return (
            <button
              key={theme}
              className={`theme-chip${isSelected ? " active" : ""}`}
              type="button"
              aria-pressed={isSelected}
              disabled={isLocked}
              onClick={() => onChange(toggleThemeSelection(normalizedSelection, theme))}
            >
              {theme}
            </button>
          );
        })}
      </div>

      {helperText ? <p className="detail-inline-copy">{helperText}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
