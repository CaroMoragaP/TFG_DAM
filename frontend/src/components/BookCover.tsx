type BookCoverProps = {
  title: string;
  coverUrl: string | null;
  className?: string;
  loading?: "eager" | "lazy";
};

export function BookCover({
  title,
  coverUrl,
  className,
  loading = "lazy",
}: BookCoverProps) {
  const coverLetter = (title.trim().slice(0, 1) || "?").toUpperCase();
  const rootClassName = className ? `book-cover-shell ${className}` : "book-cover-shell";

  return (
    <div className={rootClassName}>
      {coverUrl ? (
        <img
          className="book-cover-image"
          src={coverUrl}
          alt={`Portada de ${title}`}
          loading={loading}
        />
      ) : (
        <div className="book-cover-placeholder" aria-hidden="true">
          <span>{coverLetter}</span>
        </div>
      )}
    </div>
  );
}
