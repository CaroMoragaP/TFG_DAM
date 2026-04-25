import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddToListModal } from "../components/AddToListModal";
import { BookCard } from "../components/BookCard";
import { BookModal, type BookFormValues } from "../components/BookModal";
import { CopyEditModal, type CopyEditValues } from "../components/CopyEditModal";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  addBookToListRequest,
  createBookRequest,
  fetchBooks,
  fetchGenres,
  fetchLists,
  updateCopyRequest,
  type Book,
  type BookCreatePayload,
  type ReadingStatus,
  type UserList,
} from "../lib/api";

export function DashboardPage() {
  const { token } = useAuth();
  const { activeLibrary, activeLibraryId, isLibrariesError, isLibrariesLoading, libraries } =
    useActiveLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookForListModal, setBookForListModal] = useState<Book | null>(null);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const libraryParam = searchParams.get("library") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const readingStatus = (searchParams.get("readingStatus") ?? "") as ReadingStatus | "";
  const minRatingParam = searchParams.get("minRating") ?? "";
  const minRating = minRatingParam ? Number(minRatingParam) : undefined;
  const parsedLibraryId = Number(libraryParam);
  const selectedLibraryId =
    libraryParam && Number.isInteger(parsedLibraryId) && parsedLibraryId > 0
      ? parsedLibraryId
      : undefined;

  const editableLibraries = useMemo(
    () => libraries.filter((library) => !library.is_archived && library.role !== "viewer"),
    [libraries],
  );

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
    queryKey: ["books", { libraryId: selectedLibraryId ?? "all", q, genre, readingStatus, minRating }],
    queryFn: () =>
      fetchBooks(token ?? "", {
        libraryId: selectedLibraryId,
        q,
        genre: genre || undefined,
        readingStatus: readingStatus || undefined,
        minRating,
      }),
    enabled: Boolean(token),
  });

  const listsQuery = useQuery({
    queryKey: ["lists"],
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
      setIsCreateModalOpen(false);
    },
  });

  const updateCopyMutation = useMutation({
    mutationFn: ({ copyId, payload }: { copyId: number; payload: CopyEditValues }) =>
      updateCopyRequest(token ?? "", copyId, {
        format: payload.format,
        status: payload.status,
        physical_location: payload.physicalLocation.trim() || null,
        digital_location: payload.digitalLocation.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["copy"] }),
      ]);
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
  const visibleLists = listsQuery.data ?? [];
  const showLibraryBadge = libraries.length > 1;
  const defaultCreateLibraryId =
    editableLibraries.find((library) => library.id === activeLibraryId)?.id ??
    editableLibraries[0]?.id ??
    null;

  function updateFilter(
    key: "library" | "genre" | "readingStatus" | "minRating",
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

  function handleOpenEditModal(book: Book) {
    setSelectedBook(book);
  }

  function handleOpenAddToListModal(book: Book) {
    setBookForListModal(book);
    setAddToListError(null);
  }

  async function handleSubmitBook(values: BookFormValues) {
    const libraryId = Number(values.libraryId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      throw new Error("Selecciona una biblioteca válida para guardar el libro.");
    }

    const payload: BookCreatePayload = {
      library_id: libraryId,
      title: values.title.trim(),
      authors: [values.author.trim()],
      publication_year: values.publicationYear.trim() ? Number(values.publicationYear) : null,
      isbn: values.isbn.trim() || null,
      genres: values.genre.trim() ? [values.genre.trim()] : [],
      cover_url: values.coverUrl.trim() || null,
      reading_status: values.readingStatus,
      user_rating: values.userRating ? Number(values.userRating) : null,
    };

    await createBookMutation.mutateAsync(payload);
  }

  async function handleSubmitCopyEdit(values: CopyEditValues) {
    if (!selectedBook) {
      return;
    }

    await updateCopyMutation.mutateAsync({
      copyId: selectedBook.id,
      payload: values,
    });
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
          <p>Explora tus libros, busca por autor o ISBN y mantén el estado de lectura al día.</p>
        </div>
        <button
          className="submit-button catalog-add-button"
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isLibrariesLoading || isLibrariesError || editableLibraries.length === 0}
        >
          + Añadir libro
        </button>
      </div>

      <div className="panel subtle-panel">
        <p className="eyebrow">Biblioteca por defecto</p>
        <h3>{activeLibrary?.name ?? "Sin biblioteca por defecto"}</h3>
        <p>Se usará como destino inicial al crear libros, pero el catálogo muestra todas tus bibliotecas activas.</p>
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
            Biblioteca
            <select value={libraryParam} onChange={(event) => updateFilter("library", event.target.value)}>
              <option value="">Todas</option>
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            Género
            <select value={genre} onChange={(event) => updateFilter("genre", event.target.value)}>
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
            <select value={minRatingParam} onChange={(event) => updateFilter("minRating", event.target.value)}>
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
          <p>Ajusta la búsqueda o crea un nuevo libro para empezar a poblar tu catálogo.</p>
        </div>
      ) : null}

      {booksQuery.data && booksQuery.data.length > 0 ? (
        <div className="catalog-grid">
          {booksQuery.data.map((book) => {
            const library = libraryMap.get(book.library_id);
            const canEdit = library ? !library.is_archived && library.role !== "viewer" : false;

            return (
              <BookCard
                key={book.id}
                book={book}
                library={library}
                showLibraryBadge={showLibraryBadge}
                canEdit={canEdit}
                onAddToList={handleOpenAddToListModal}
                onEdit={handleOpenEditModal}
              />
            );
          })}
        </div>
      ) : null}

      <BookModal
        book={null}
        defaultLibraryId={defaultCreateLibraryId}
        genres={genresQuery.data ?? []}
        isOpen={isCreateModalOpen}
        isSaving={createBookMutation.isPending}
        libraries={editableLibraries}
        mode="create"
        onClose={() => {
          if (createBookMutation.isPending) {
            return;
          }
          setIsCreateModalOpen(false);
        }}
        onSubmit={handleSubmitBook}
        token={token ?? ""}
      />

      <CopyEditModal
        copy={selectedBook}
        library={selectedBook ? libraryMap.get(selectedBook.library_id) ?? null : null}
        isOpen={selectedBook !== null}
        isSaving={updateCopyMutation.isPending}
        onClose={() => {
          if (updateCopyMutation.isPending) {
            return;
          }
          setSelectedBook(null);
        }}
        onSubmit={handleSubmitCopyEdit}
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
