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
  variant?: "chips" | "dropdowns";
};

export function ThemeSelector({
  error,
  helperText,
  onChange,
  options,
  selectedThemes,
  variant = "chips",
}: ThemeSelectorProps) {
  const normalizedSelection = normalizeThemeSelection(selectedThemes);
  const visibleOptions = Array.from(new Set([...normalizedSelection, ...options]));
  const themeSlots = Array.from({ length: MAX_BOOK_THEMES }, (_, index) => normalizedSelection[index] ?? "");

  function handleDropdownChange(index: number, value: string) {
    const nextSlots = [...themeSlots];
    nextSlots[index] = value;
    onChange(normalizeThemeSelection(nextSlots));
  }

  return (
    <div className="field-group field-span-full">
      <div className="theme-selector-header">
        <span>Temas</span>
        <span className="theme-selector-counter">
          {normalizedSelection.length}/{MAX_BOOK_THEMES} seleccionados
        </span>
      </div>

      {variant === "dropdowns" ? (
        <div className="theme-dropdown-grid" role="group" aria-label="Temas">
          {themeSlots.map((selectedTheme, index) => {
            const otherSelections = themeSlots.filter(
              (theme, otherIndex) => otherIndex !== index && theme.length > 0,
            );
            const availableOptions = visibleOptions.filter(
              (theme) => theme === selectedTheme || !otherSelections.includes(theme),
            );

            return (
              <label key={`theme-slot-${index + 1}`} className="theme-dropdown-field">
                <span>Tema {index + 1}</span>
                <select
                  value={selectedTheme}
                  onChange={(event) => handleDropdownChange(index, event.target.value)}
                >
                  <option value="">Sin tema</option>
                  {availableOptions.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : (
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
      )}

      {helperText ? <p className="detail-inline-copy">{helperText}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
