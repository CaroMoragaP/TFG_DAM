export const LITERARY_GENRE_OPTIONS = [
  { value: "narrativo", label: "Narrativo" },
  { value: "l\u00edrico", label: "L\u00edrico" },
  { value: "dram\u00e1tico", label: "Dram\u00e1tico" },
  { value: "did\u00e1ctico", label: "Did\u00e1ctico" },
] as const;

export const MAX_BOOK_THEMES = 3;

export type SharedBookFormValues = {
  title: string;
  authorFirstName: string;
  authorLastName: string;
  publicationYear: string;
  coverUrl: string;
  themes: string[];
};

export type SharedBookFormErrors = Partial<
  Record<"title" | "authorFirstName" | "publicationYear" | "coverUrl" | "themes", string>
>;

export function normalizeThemeSelection(themes: string[]) {
  const seen = new Set<string>();
  const normalizedThemes: string[] = [];

  themes.forEach((theme) => {
    const normalized = theme.trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalizedThemes.push(normalized);
  });

  return normalizedThemes.slice(0, MAX_BOOK_THEMES);
}

export function validateSharedBookFields(values: SharedBookFormValues): SharedBookFormErrors {
  const errors: SharedBookFormErrors = {};

  if (!values.title.trim()) {
    errors.title = "El titulo es obligatorio.";
  }

  if (!values.authorFirstName.trim() && !values.authorLastName.trim()) {
    errors.authorFirstName = "El autor es obligatorio.";
  }

  if (values.publicationYear.trim()) {
    const parsedYear = Number(values.publicationYear);
    if (!Number.isInteger(parsedYear) || parsedYear < 0 || parsedYear > 9999) {
      errors.publicationYear = "Introduce un ano valido.";
    }
  }

  if (values.coverUrl.trim()) {
    try {
      new URL(values.coverUrl);
    } catch {
      errors.coverUrl = "Introduce una URL valida.";
    }
  }

  if (values.themes.length > MAX_BOOK_THEMES) {
    errors.themes = `Selecciona como maximo ${MAX_BOOK_THEMES} temas.`;
  }

  return errors;
}

export function toggleThemeSelection(selectedThemes: string[], theme: string) {
  const normalizedThemes = normalizeThemeSelection(selectedThemes);
  if (normalizedThemes.includes(theme)) {
    return normalizedThemes.filter((selectedTheme) => selectedTheme !== theme);
  }

  if (normalizedThemes.length >= MAX_BOOK_THEMES) {
    return normalizedThemes;
  }

  return [...normalizedThemes, theme];
}

export function isThemeSelectionLocked(selectedThemes: string[], theme: string) {
  return selectedThemes.length >= MAX_BOOK_THEMES && !selectedThemes.includes(theme);
}
