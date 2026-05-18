import type { ListType, ReadingStatus } from "./api";

export const readingStatusValueLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  finished: "Leído",
};

export const readingStatusSectionLabels: Record<ReadingStatus, string> = {
  pending: "Pendientes",
  reading: "Leyendo",
  finished: "Leídos",
};

export const listTypeLabels: Record<ListType, string> = {
  wishlist: "Deseos",
  pending: "Pendientes",
  custom: "Personalizada",
};
