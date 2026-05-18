type StarRatingProps = {
  rating: number | null;
  className?: string;
  max?: number;
};

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3.65 2.57 5.2 5.74.84-4.15 4.04.98 5.7L12 16.72 6.86 19.43l.98-5.7-4.15-4.04 5.74-.84L12 3.65Z" />
    </svg>
  );
}

export function StarRating({ rating, className, max = 5 }: StarRatingProps) {
  return (
    <div
      className={className ?? "dashboard-star-rating"}
      aria-label={rating === null ? "Sin puntuacion" : `Puntuacion personal ${rating} de ${max}`}
    >
      {Array.from({ length: max }).map((_, index) => {
        const fill = rating === null ? 0 : Math.max(0, Math.min(1, rating - index));

        return (
          <span key={index} className="dashboard-star">
            <span className="dashboard-star-base">
              <StarIcon />
            </span>
            <span className="dashboard-star-fill" style={{ width: `${fill * 100}%` }}>
              <StarIcon />
            </span>
          </span>
        );
      })}
    </div>
  );
}
