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

function BookPlaceholderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.5 4.25A2.25 2.25 0 0 1 8.75 2h7a2.25 2.25 0 0 1 2.25 2.25V18a.75.75 0 0 1-1.22.58l-2.32-1.85a1 1 0 0 0-1.24 0l-1.44 1.14a1 1 0 0 1-1.24 0l-1.44-1.14a1 1 0 0 0-1.24 0L5.47 18.6A.75.75 0 0 1 4.25 18V6.5A2.25 2.25 0 0 1 6.5 4.25Z"
        fill="currentColor"
      />
      <path
        d="M9 7.25A.75.75 0 0 1 9.75 6.5h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 9 7.25Zm0 3A.75.75 0 0 1 9.75 9.5h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 9 10.25Z"
        fill="#fdf9cd"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 5.25a.75.75 0 0 1 .75.75v5.25H18a.75.75 0 0 1 0 1.5h-5.25V18a.75.75 0 0 1-1.5 0v-5.25H6a.75.75 0 0 1 0-1.5h5.25V6a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M15.27 5.35a2.1 2.1 0 0 1 2.97 2.97l-8.4 8.4-3.38.42a.75.75 0 0 1-.83-.83l.42-3.38 8.4-8.4Zm1.9 1.06a.6.6 0 0 0-.84 0l-1 1 1.9 1.9 1-1a.6.6 0 0 0 0-.84l-1.06-1.06Zm-.84 3.96-1.9-1.9-6.76 6.76-.19 1.53 1.53-.19 7.32-7.2Z"
        fill="currentColor"
      />
    </svg>
  );
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

  return (
    <article className="dashboard-book-card">
      <div className="dashboard-book-cover-shell">
        <Link
          className="dashboard-book-cover"
          to={`/libros/${book.id}`}
          aria-label={`Ver detalle de ${book.title}`}
        >
          {book.cover_url ? (
            <img src={book.cover_url} alt={`Portada de ${book.title}`} loading="lazy" />
          ) : (
            <div className="dashboard-book-cover-fallback" aria-hidden="true">
              <span className="dashboard-book-cover-fallback-icon">
                <BookPlaceholderIcon />
              </span>
            </div>
          )}
        </Link>

        <div className="dashboard-book-cover-top">
          <ReadingStatusBadge status={book.reading_status} />
          {canEdit ? (
            <button
              className="dashboard-book-edit-button"
              type="button"
              onClick={() => onEdit(book)}
              aria-label={`Editar ${book.title}`}
            >
              <EditIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div className="dashboard-book-body">
        <div className="dashboard-book-copy">
          <h3>
            <Link to={`/libros/${book.id}`}>{book.title}</Link>
          </h3>
          <p className="dashboard-book-author">{author}</p>
        </div>

        <StarRating rating={book.user_rating} />

        {showLibraryBadge && library ? (
          <p className="dashboard-book-library">{library.name}</p>
        ) : null}

        <button className="dashboard-card-button" type="button" onClick={() => onAddToList(book)}>
          <span className="dashboard-card-button-icon">
            <PlusIcon />
          </span>
          <span>Añadir a lista</span>
        </button>
      </div>
    </article>
  );
}
