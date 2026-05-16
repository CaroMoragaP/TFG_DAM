import { Link } from "react-router-dom";

import type { Book, Library } from "../lib/api";
import { ReadingStatusBadge } from "./ReadingStatusBadge";
import { StarRating } from "./StarRating";

type BookCardProps = {
  book: Book;
  library?: Library;
  showLibraryBadge: boolean;
  canEdit?: boolean;
  onAddToList: (book: Book) => void;
  onEdit: (book: Book) => void;
};

function formatPublicRating(value: number | null) {
  return value === null ? "sin media" : `${value.toFixed(1)}/5`;
}

function formatLoanLine(book: Book) {
  if (!book.active_loan) {
    return null;
  }

  const dueDate = book.active_loan.due_date
    ? ` hasta ${new Date(book.active_loan.due_date).toLocaleDateString("es-ES")}`
    : "";
  return `Prestado a ${book.active_loan.borrower_name}${dueDate}`;
}

function formatReadersLine(book: Book) {
  const sharedReadersCount = book.shared_readers_count ?? 0;
  const sharedReadersPreview = book.shared_readers_preview ?? [];

  if (sharedReadersCount <= 0) {
    return null;
  }

  if (sharedReadersCount === 1 && sharedReadersPreview[0]) {
    return `Lo esta leyendo ${sharedReadersPreview[0].name}`;
  }

  return `${sharedReadersCount} miembros lo estan leyendo`;
}

export function BookCard({
  book,
  library,
  showLibraryBadge,
  canEdit = true,
  onAddToList,
  onEdit,
}: BookCardProps) {
  const author = book.authors[0] ?? "Autor sin registrar";
  const coverLetter = (book.title.trim().slice(0, 1) || "?").toUpperCase();
  const loanLine = formatLoanLine(book);
  const readersLine = formatReadersLine(book);
  const publicReviewCount = book.public_review_count ?? 0;
  const hasCommunitySummary = book.active_loan != null || Boolean(readersLine) || publicReviewCount > 0;
  const detailChips = [book.genre, book.collection, book.author_country].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <article className="dashboard-book-card panel">
      <Link
        className="dashboard-book-cover"
        to={`/libros/${book.id}`}
        aria-label={`Ver detalle de ${book.title}`}
      >
        {book.cover_url ? (
          <img src={book.cover_url} alt={`Portada de ${book.title}`} />
        ) : (
          <div className="dashboard-book-cover-fallback" aria-hidden="true">
            <span className="dashboard-book-cover-letter">{coverLetter}</span>
          </div>
        )}

        <div className="dashboard-book-overlay">
          <ReadingStatusBadge status={book.reading_status} />
        </div>
      </Link>

      <div className="dashboard-book-body">
        <div className="dashboard-book-heading">
          <div className="dashboard-book-title-block">
            <h3>
              <Link to={`/libros/${book.id}`}>{book.title}</Link>
            </h3>
            <p className="dashboard-book-author">{author}</p>
          </div>

          {showLibraryBadge && library ? (
            <span className="dashboard-library-pill">{library.name}</span>
          ) : null}
        </div>

        <StarRating rating={book.user_rating} />

        {detailChips.length > 0 ? (
          <div className="dashboard-book-chip-row">
            {detailChips.map((chip) => (
              <span key={chip} className="dashboard-book-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {hasCommunitySummary ? (
          <div className="dashboard-book-community">
            {loanLine ? <p className="detail-inline-copy">{loanLine}</p> : null}
            {readersLine ? <p className="detail-inline-copy">{readersLine}</p> : null}
            {publicReviewCount > 0 ? (
              <p className="detail-inline-copy">
                {publicReviewCount} resenas publicas - {formatPublicRating(book.public_average_rating)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="dashboard-book-actions">
          <button
            className="dashboard-card-button dashboard-card-button-secondary"
            type="button"
            onClick={() => onAddToList(book)}
          >
            Anadir a lista
          </button>
          {canEdit ? (
            <button
              className="dashboard-card-button dashboard-card-button-primary"
              type="button"
              onClick={() => onEdit(book)}
            >
              Editar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
