type StarRatingProps = {
  rating: number | null;
  max?: number;
};

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3.8 2.42 4.9 5.4.79-3.91 3.8.92 5.37L12 16.1l-4.83 2.55.92-5.37-3.91-3.8 5.4-.79L12 3.8Z" />
    </svg>
  );
}

export function StarRating({ rating, max = 5 }: StarRatingProps) {
  return (
    <div
      className="dashboard-star-rating"
      aria-label={rating === null ? "Sin puntuacion" : `Puntuacion personal ${rating} de ${max}`}
    >
      <div className="dashboard-star-rating-stars" aria-hidden="true">
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
      <span className="dashboard-star-rating-value">{rating === null ? "Sin nota" : `${rating}/5`}</span>
    </div>
  );
}
