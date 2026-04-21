import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddToListModal } from "../components/AddToListModal";
import { BookCard } from "../components/BookCard";
import { BookModal, type BookFormValues } from "../components/BookModal";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  addBookToListRequest,
  createBookRequest,
  fetchBooks,
  fetchGenres,
  fetchLists,
  updateBookRequest,
  type Book,
  type BookCreatePayload,
  type BookUpdatePayload,
  type ReadingStatus,
  type UserList,
} from "../lib/api";

export function DashboardPage() {
  const { token } = useAuth();
  const { activeLibrary, activeLibraryId, isLibrariesError, isLibrariesLoading, libraries } =
    useActiveLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [activeModalMode, setActiveModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookForListModal, setBookForListModal] = useState<Book | null>(null);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const readingStatus = (searchParams.get("readingStatus") ?? "") as ReadingStatus | "";
  const minRatingParam = searchParams.get("minRating") ?? "";
  const minRating = minRatingParam ? Number(minRatingParam) : undefined;

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedQuery = searchDraft.trim();
      if (normalizedQuery === q) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams);
      if (normalizedQuery) {
        nextSearchParams.set("q", normalizedQuery);
      } else {
        nextSearchParams.delete("q");
      }
      setSearchParams(nextSearchParams, { replace: true });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [q, searchDraft, searchParams, setSearchParams]);

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: () => fetchGenres(token ?? ""),
    enabled: Boolean(token),
  });

  const booksQuery = useQuery({
    queryKey: ["books", { libraryId: activeLibraryId, q, genre, readingStatus, minRating }],
    queryFn: () =>
      fetchBooks(token ?? "", {
        libraryId: activeLibraryId ?? undefined,
        q,
        genre: genre || undefined,
        readingStatus: readingStatus || undefined,
        minRating,
      }),
    enabled: Boolean(token && activeLibraryId),
  });

  const listsQuery = useQuery({
    queryKey: ["lists", activeLibraryId],
    queryFn: () => fetchLists(token ?? ""),
    enabled: Boolean(token),
  });

  const createBookMutation = useMutation({
    mutationFn: (payload: BookCreatePayload) => createBookRequest(token ?? "", payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["genres"] }),
      ]);
      setActiveModalMode(null);
      setSelectedBook(null);
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: ({ bookId, payload }: { bookId: number; payload: BookUpdatePayload }) =>
      updateBookRequest(token ?? "", bookId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["genres"] }),
      ]);
      setActiveModalMode(null);
      setSelectedBook(null);
    },
  });

  const addBookToListMutation = useMutation({
    mutationFn: ({ listId, bookId }: { listId: number; bookId: number }) =>
      addBookToListRequest(token ?? "", listId, { book_id: bookId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["list-books"] }),
      ]);
      setBookForListModal(null);
      setAddToListError(null);
    },
    onError: (error) => {
      setAddToListError(
        error instanceof Error ? error.message : "No se pudo añadir el libro a la lista.",
      );
    },
  });

  const libraryMap = new Map(libraries.map((library) => [library.id, library]));
  const visibleLists = (listsQuery.data ?? []).filter(
    (list) => list.library_id === null || list.library_id === activeLibraryId,
  );
  const isModalOpen = activeModalMode !== null;
  const showLibraryBadge = libraries.length > 1;

  function updateFilter(
    key: "genre" | "readingStatus" | "minRating",
    value: string,
  ) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (value) {
      nextSearchParams.set(key, value);
    } else {
      nextSearchParams.delete(key);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }

  function handleOpenCreateModal() {
    setSelectedBook(null);
    setActiveModalMode("create");
  }

  function handleOpenEditModal(book: Book) {
    setSelectedBook(book);
    setActiveModalMode("edit");
  }

  function handleOpenAddToListModal(book: Book) {
    setBookForListModal(book);
    setAddToListError(null);
  }

  function handleCloseModal() {
    if (createBookMutation.isPending || updateBookMutation.isPending) {
      return;
    }
    setActiveModalMode(null);
    setSelectedBook(null);
  }

  async function handleSubmitBook(values: BookFormValues) {
    if (activeModalMode === "edit" && selectedBook) {
      const payload: BookUpdatePayload = {
        title: values.title.trim(),
        authors: [values.author.trim()],
        publication_year: values.publicationYear.trim()
          ? Number(values.publicationYear)
          : null,
        isbn: values.isbn.trim() || null,
        genres: values.genre.trim() ? [values.genre.trim()] : [],
        cover_url: values.coverUrl.trim() || null,
        reading_status: values.readingStatus,
        user_rating: values.userRating ? Number(values.userRating) : null,
      };

      await updateBookMutation.mutateAsync({
        bookId: selectedBook.id,
        payload,
      });
      return;
    }

    if (!activeLibraryId) {
      throw new Error("No se encontró una biblioteca activa para guardar el libro.");
    }

    const payload: BookCreatePayload = {
      library_id: activeLibraryId,
      title: values.title.trim(),
      authors: [values.author.trim()],
      publication_year: values.publicationYear.trim()
        ? Number(values.publicationYear)
        : null,
      isbn: values.isbn.trim() || null,
      genres: values.genre.trim() ? [values.genre.trim()] : [],
      cover_url: values.coverUrl.trim() || null,
      reading_status: values.readingStatus,
      user_rating: values.userRating ? Number(values.userRating) : null,
    };

    await createBookMutation.mutateAsync(payload);
  }

  async function handleSelectList(list: UserList) {
    if (!bookForListModal) {
      return;
    }

    await addBookToListMutation.mutateAsync({
      listId: list.id,
      bookId: bookForListModal.book_id,
    });
  }

  return (
    <section className="content-stack">
      <div className="catalog-hero panel hero-panel">
        <div>
          <p className="eyebrow">Catálogo privado</p>
          <h2>Mi catálogo</h2>
          <p>
            Explora tus libros, busca por autor o ISBN y mantén el estado de lectura al día.
          </p>
        </div>
        <button
          className="submit-button catalog-add-button"
          type="button"
          onClick={handleOpenCreateModal}
          disabled={isLibrariesLoading || isLibrariesError || !activeLibraryId}
        >
          + Añadir libro
        </button>
      </div>

      <div className="panel subtle-panel">
        <p className="eyebrow">Biblioteca activa</p>
        <h3>{activeLibrary?.name ?? "Sin biblioteca activa"}</h3>
        <p>El catálogo y las listas se filtran automáticamente por esta biblioteca.</p>
      </div>

      <div className="panel catalog-toolbar">
        <div className="catalog-search-block">
          <label className="field-group">
            Buscar
            <input
              placeholder="Buscar por título, autor, ISBN..."
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
        </div>

        <div className="catalog-filters">
          <label className="field-group">
            Género
            <select
              value={genre}
              onChange={(event) => updateFilter("genre", event.target.value)}
            >
              <option value="">Todos</option>
              {(genresQuery.data ?? []).map((genreOption) => (
                <option key={genreOption} value={genreOption}>
                  {genreOption}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            Estado de lectura
            <select
              value={readingStatus}
              onChange={(event) => updateFilter("readingStatus", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="reading">Leyendo</option>
              <option value="finished">Leído</option>
            </select>
          </label>

          <label className="field-group">
            Valoración mínima
            <select
              value={minRatingParam}
              onChange={(event) => updateFilter("minRating", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="1">1+ estrellas</option>
              <option value="2">2+ estrellas</option>
              <option value="3">3+ estrellas</option>
              <option value="4">4+ estrellas</option>
              <option value="5">5 estrellas</option>
            </select>
          </label>
        </div>
      </div>

      {isLibrariesError ? (
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas accesibles.</p>
        </div>
      ) : null}

      {booksQuery.isPending ? (
        <div className="catalog-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="book-skeleton panel" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {booksQuery.isError ? (
        <div className="panel">
          <p>No se pudo cargar el catálogo. Revisa que FastAPI siga levantado.</p>
        </div>
      ) : null}

      {booksQuery.data && booksQuery.data.length === 0 ? (
        <div className="panel empty-state">
          <h3>No hay libros con esos filtros.</h3>
          <p>
            Ajusta la búsqueda o crea un nuevo libro para empezar a poblar tu catálogo.
          </p>
        </div>
      ) : null}

      {booksQuery.data && booksQuery.data.length > 0 ? (
        <div className="catalog-grid">
          {booksQuery.data.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              library={libraryMap.get(book.library_id)}
              showLibraryBadge={showLibraryBadge}
              onAddToList={handleOpenAddToListModal}
              onEdit={handleOpenEditModal}
            />
          ))}
        </div>
      ) : null}

      <BookModal
        book={selectedBook}
        defaultLibraryId={activeLibraryId ?? null}
        genres={genresQuery.data ?? []}
        isOpen={isModalOpen}
        isSaving={createBookMutation.isPending || updateBookMutation.isPending}
        libraries={libraries}
        mode={activeModalMode ?? "create"}
        onClose={handleCloseModal}
        onSubmit={handleSubmitBook}
        token={token ?? ""}
      />

      <AddToListModal
        book={bookForListModal}
        errorMessage={addToListError}
        isOpen={bookForListModal !== null}
        isSaving={addBookToListMutation.isPending}
        lists={visibleLists}
        onClose={() => {
          if (addBookToListMutation.isPending) {
            return;
          }
          setBookForListModal(null);
          setAddToListError(null);
        }}
        onSelectList={handleSelectList}
      />
    </section>
  );
}
