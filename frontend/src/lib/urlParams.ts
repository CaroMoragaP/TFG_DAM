export function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function normalizePositiveIntegerParam(value: string | null): number | null {
  return parsePositiveInt(value) ?? null;
}

export function normalizeLibraryFilterParam(value: string | null): string {
  const parsed = parsePositiveInt(value);
  if (!value || value === "all" || parsed === undefined) {
    return "all";
  }

  return String(parsed);
}
