import type { ReadingStatus } from "../lib/api";

const STATUS_COPY: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  finished: "Leido",
};

type ReadingStatusBadgeProps = {
  status: ReadingStatus;
};

export function ReadingStatusBadge({ status }: ReadingStatusBadgeProps) {
  return (
    <span className={`dashboard-status-badge is-${status}`}>
      <span className="dashboard-status-badge-dot" aria-hidden="true" />
      {STATUS_COPY[status] ?? status}
    </span>
  );
}
