import type { ReadingStatus } from "../lib/api";
import { readingStatusValueLabels } from "../lib/labels";

type ReadingStatusBadgeProps = {
  status: ReadingStatus;
};

export function ReadingStatusBadge({ status }: ReadingStatusBadgeProps) {
  return <span className={`dashboard-status-badge is-${status}`}>{readingStatusValueLabels[status] ?? status}</span>;
}
