import { Link } from "react-router-dom";

import type { Book, Library, ReadingStatus } from "../lib/api";

type BookCardProps = {
  book: Book;
  library?: Library;
  showLibraryBadge: boolean;
  canEdit?: boolean;
  onAddToList: (book: Book) => void;
  onEdit: (book: Book) => void;
};

const readingStatusCopy: Record<
  ReadingStatus,
  { label: string; toneClass: string; iconLabel: string }
> = {
  pending: {
    label: "Pendiente",
    toneClass: "pending",
    iconLabel: "P",
  },
  reading: {
    label: "Leyendo",
    toneClass: "reading",
    iconLabel: "L",
  },
  finished: {
    label: "Leido",
    toneClass: "finished",
    iconLabel: "T",
  },
};

function formatRating(value: number | null) {
  return value === null ? "-" : `${value}/5`;
}

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
  if (book.shared_readers_count <= 0) {
    return null;
  }

  if (book.shared_readers_count === 1 && book.shared_readers_preview[0]) {
    return `Lo esta leyendo ${book.shared_readers_preview[0].name}`;
  }

  return `${book.shared_readers_count} miembros lo estan leyendo`;
}

export function BookCard({
  book,
  library,
  showLibraryBadge,
  canEdit = true,
  onAddToList,
  onEdit,
}: BookCardProps) {
  const statusInfo = readingStatusCopy[book.reading_status];
  const author = book.authors[0] ?? "Autor sin registrar";
  const coverLetter = (book.title.trim().slice(0, 1) || "?").toUpperCase();
  const loanLine = formatLoanLine(book);
  const readersLine = formatReadersLine(book);
  const hasCommunitySummary =
    book.active_loan !== null || book.shared_readers_count > 0 || book.public_review_count > 0;

  return (
    <article className="book-card panel">
      <Link className="book-cover-shell" to={`/libros/${book.id}`} aria-label={`Ver detalle de ${book.title}`}>
        {book.cover_url ? (
          <img className="book-cover-image" src={book.cover_url} alt={`Portada de ${book.title}`} />
        ) : (
          <div className="book-cover-placeholder" aria-hidden="true">
            <span>{coverLetter}</span>
          </div>
        )}
      </Link>

      <div className="book-card-body">
        <div className="book-card-head">
          <div>
            <h3>
              <Link to={`/libros/${book.id}`}>{book.title}</Link>
            </h3>
            <p className="book-card-author">{author}</p>
          </div>
          <div className="card-actions">
            <button className="ghost-link compact-action" type="button" onClick={() => onAddToList(book)}>
              Anadir a lista
            </button>
            {canEdit ? (
              <button className="ghost-link compact-action" type="button" onClick={() => onEdit(book)}>
                Editar
              </button>
            ) : null}
          </div>
        </div>

        <dl className="book-meta-grid">
          <div>
            <dt>Rating</dt>
            <dd>{formatRating(book.user_rating)}</dd>
          </div>
          <div>
            <dt>Genero</dt>
            <dd>{book.genre ?? "-"}</dd>
          </div>
          <div>
            <dt>Coleccion</dt>
            <dd>{book.collection ?? "-"}</dd>
          </div>
          <div>
            <dt>Pais autor</dt>
            <dd>{book.author_country ?? "-"}</dd>
          </div>
        </dl>

        {hasCommunitySummary ? (
          <div className="book-community-stack">
            {loanLine ? <p className="detail-inline-copy">{loanLine}</p> : null}
            {readersLine ? <p className="detail-inline-copy">{readersLine}</p> : null}
            {book.public_review_count > 0 ? (
              <p className="detail-inline-copy">
                {book.public_review_count} resenas publicas · {formatPublicRating(book.public_average_rating)}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="book-card-footer">
          <span className={`reading-pill ${statusInfo.toneClass}`}>
            <span className="reading-pill-icon" aria-hidden="true">
              {statusInfo.iconLabel}
            </span>
            {statusInfo.label}
          </span>

          {showLibraryBadge && library ? <span className="library-badge">{library.name}</span> : null}
        </div>
      </div>
    </article>
  );
}
