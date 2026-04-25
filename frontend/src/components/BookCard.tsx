import { Link } from "react-router-dom";

import type { Book, Library, ReadingStatus } from "../lib/api";

type BookCardProps = {
  book: Book;
  library?: Library;
  showLibraryBadge: boolean;
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
    label: "Leído",
    toneClass: "finished",
    iconLabel: "T",
  },
};

function formatRating(value: number | null) {
  return value === null ? "-" : `${value}/5`;
}

export function BookCard({
  book,
  library,
  showLibraryBadge,
  onAddToList,
  onEdit,
}: BookCardProps) {
  const statusInfo = readingStatusCopy[book.reading_status];
  const author = book.authors[0] ?? "Autor sin registrar";
  const coverLetter = (book.title.trim().slice(0, 1) || "?").toUpperCase();

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
            <button
              className="ghost-link compact-action"
              type="button"
              onClick={() => onAddToList(book)}
            >
              Añadir a lista
            </button>
            <button className="ghost-link compact-action" type="button" onClick={() => onEdit(book)}>
              Editar
            </button>
          </div>
        </div>

        <dl className="book-meta-grid">
          <div>
            <dt>Rating</dt>
            <dd>{formatRating(book.user_rating)}</dd>
          </div>
          <div>
            <dt>Género</dt>
            <dd>{book.genres[0] ?? "-"}</dd>
          </div>
        </dl>

        <div className="book-card-footer">
          <span className={`reading-pill ${statusInfo.toneClass}`}>
            <span className="reading-pill-icon" aria-hidden="true">
              {statusInfo.iconLabel}
            </span>
            {statusInfo.label}
          </span>

          {showLibraryBadge && library ? (
            <span className="library-badge">{library.name}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
