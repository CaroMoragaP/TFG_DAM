function normalizePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function normalizePositiveIntegerParam(value: string | null): number | null {
  return normalizePositiveInteger(value);
}

export function normalizeLibraryFilterParam(value: string | null): string {
  if (!value || value === "all") {
    return "all";
  }

  const parsed = normalizePositiveInteger(value);
  return parsed === null ? "all" : String(parsed);
}
