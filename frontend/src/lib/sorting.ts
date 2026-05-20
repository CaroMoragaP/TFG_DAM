export function compareText(left: string, right: string) {
  return left.localeCompare(right, "es", { sensitivity: "base" });
}
