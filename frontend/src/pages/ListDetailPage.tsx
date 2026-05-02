import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import {
  fetchListBooks,
  fetchLists,
  removeBookFromListRequest,
  type ListBookSummary,
} from "../lib/api";

type SortOption = "recent" | "oldest" | "title" | "author" | "year";

const addedAtFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function compareText(left: string, right: string) {
  return left.localeCompare(right, "es", { sensitivity: "base" });
}

function compareYearDescending(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}

function sortBooks(books: ListBookSummary[], sort: SortOption) {
  const sorted = [...books];

  sorted.sort((left, right) => {
    if (sort === "recent") {
      const addedAtDifference =
        new Date(right.added_at).getTime() - new Date(left.added_at).getTime();
      if (addedAtDifference !== 0) {
        return addedAtDifference;
      }
      return compareText(left.title, right.title);
    }

    if (sort === "oldest") {
      const addedAtDifference =
        new Date(left.added_at).getTime() - new Date(right.added_at).getTime();
      if (addedAtDifference !== 0) {
        return addedAtDifference;
      }
      return compareText(left.title, right.title);
    }

    if (sort === "title") {
      return compareText(left.title, right.title);
    }

    if (sort === "author") {
      const authorDifference = compareText(left.authors[0] ?? "", right.authors[0] ?? "");
      if (authorDifference !== 0) {
        return authorDifference;
      }
      return compareText(left.title, right.title);
    }

    const yearDifference = compareYearDescending(left.publication_year, right.publication_year);
    if (yearDifference !== 0) {
      return yearDifference;
    }
    return compareText(left.title, right.title);
  });

  return sorted;
}

function formatAddedAt(value: string) {
  return addedAtFormatter.format(new Date(value));
}

function renderCover(book: ListBookSummary) {
  const coverLetter = (book.title.trim().slice(0, 1) || "?").toUpperCase();

  if (book.cover_url) {
    return <img className="book-cover-image" src={book.cover_url} alt={`Portada de ${book.title}`} />;
  }

  return (
    <div className="book-cover-placeholder" aria-hidden="true">
      <span>{coverLetter}</span>
    </div>
  );
}

export function ListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [sort, setSort] = useState<SortOption>("recent");

  const listId = Number(id);
  const isValidListId = Number.isInteger(listId) && listId > 0;

  const listsQuery = useQuery({
    queryKey: ["lists"],
    queryFn: () => fetchLists(token ?? ""),
    enabled: Boolean(token && isValidListId),
  });

  const booksQuery = useQuery({
    queryKey: ["list-books", listId],
    queryFn: () => fetchListBooks(token ?? "", listId),
    enabled: Boolean(token && isValidListId),
  });

  const removeBookMutation = useMutation({
    mutationFn: (bookId: number) => removeBookFromListRequest(token ?? "", listId, bookId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["list-books", listId] }),
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]);
    },
  });

  const activeList = useMemo(
    () => (listsQuery.data ?? []).find((list) => list.id === listId) ?? null,
    [listId, listsQuery.data],
  );
  const sortedBooks = useMemo(() => sortBooks(booksQuery.data ?? [], sort), [booksQuery.data, sort]);
  const booksErrorMessage =
    booksQuery.error instanceof Error ? booksQuery.error.message : "No se pudo cargar el contenido de la lista.";

  if (!isValidListId) {
    return (
      <section className="content-stack">
        <div className="panel">
          <p>El identificador de la lista no es valido.</p>
        </div>
      </section>
    );
  }

  const isLoading = listsQuery.isPending || booksQuery.isPending;
  const isListUnavailable = listsQuery.isSuccess && activeList === null;

  async function handleRemoveBook(bookId: number) {
    if (!window.confirm("Se quitara este libro de la lista. Quieres continuar?")) {
      return;
    }

    await removeBookMutation.mutateAsync(bookId);
  }

  return (
    <section className="content-stack">
      <button className="ghost-link detail-back-button" type="button" onClick={() => navigate("/listas")}>
        Volver a mis listas
      </button>

      {isLoading ? (
        <div className="panel">
          <p>Cargando detalle de la lista...</p>
        </div>
      ) : null}

      {listsQuery.isError ? (
        <div className="panel">
          <p>No se pudieron cargar tus listas.</p>
        </div>
      ) : null}

      {booksQuery.isError ? (
        <div className="panel content-stack">
          <p>{booksErrorMessage}</p>
          <div className="inline-actions">
            <Link className="ghost-link compact-action" to="/catalogo">
              Ir al catalogo
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !listsQuery.isError && !booksQuery.isError && isListUnavailable ? (
        <div className="panel empty-state">
          <h3>La lista ya no esta disponible.</h3>
          <p>Puede que se haya eliminado o que ya no pertenezca al usuario autenticado.</p>
        </div>
      ) : null}

      {!isLoading && !listsQuery.isError && !booksQuery.isError && activeList ? (
        <>
          <div className="panel hero-panel list-detail-hero">
            <div>
              <p className="eyebrow">Detalle de lista</p>
              <h2>{activeList.name}</h2>
              <p>
                {activeList.book_count} {activeList.book_count === 1 ? "libro guardado" : "libros guardados"} en esta
                lista personal.
              </p>
            </div>

            <div className="list-detail-hero-aside">
              <span className="status-chip active">{activeList.type}</span>
              <Link className="ghost-link compact-action" to={`/catalogo?listId=${activeList.id}`}>
                Ver esta lista en catalogo
              </Link>
            </div>
          </div>

          <div className="panel list-detail-toolbar">
            <label className="field-group">
              Ordenar por
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                <option value="recent">Mas recientes</option>
                <option value="oldest">Mas antiguos</option>
                <option value="title">Titulo A-Z</option>
                <option value="author">Autor A-Z</option>
                <option value="year">Ano mas reciente</option>
              </select>
            </label>
          </div>

          {sortedBooks.length === 0 ? (
            <div className="panel empty-state">
              <h3>Esta lista esta vacia.</h3>
              <p>Anade libros desde el catalogo usando la accion "Anadir a lista".</p>
              <div className="inline-actions">
                <Link className="ghost-link compact-action" to="/catalogo">
                  Ir al catalogo
                </Link>
              </div>
            </div>
          ) : (
            <div className="content-stack">
              {sortedBooks.map((book) => (
                <article key={book.book_id} className="panel list-book-card list-book-card-detailed">
                  <div className="list-book-cover">{renderCover(book)}</div>

                  <div className="list-book-content">
                    <div>
                      <p className="eyebrow">Libro en lista</p>
                      <h3>{book.title}</h3>
                      <p>{book.authors[0] ?? "Autor sin registrar"}</p>
                    </div>

                    <dl className="list-book-meta-grid">
                      <div>
                        <dt>Genero</dt>
                        <dd>{book.genre ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Coleccion</dt>
                        <dd>{book.collection ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Ano</dt>
                        <dd>{book.publication_year ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Anadido</dt>
                        <dd>{formatAddedAt(book.added_at)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="list-book-actions">
                    <button
                      className="ghost-link compact-action danger-action"
                      type="button"
                      onClick={() => handleRemoveBook(book.book_id)}
                      disabled={removeBookMutation.isPending}
                    >
                      Quitar de la lista
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
