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
  const { activeLibraryId, isLibrariesError, isLibrariesLoading, libraries } = useActiveLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookForListModal, setBookForListModal] = useState<Book | null>(null);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const libraryParam = searchParams.get("library") ?? "";
  const listIdParam = searchParams.get("listId") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const collection = searchParams.get("collection") ?? "";
  const authorCountry = searchParams.get("authorCountry") ?? "";
  const readingStatus = (searchParams.get("readingStatus") ?? "") as ReadingStatus | "";
  const minRatingParam = searchParams.get("minRating") ?? "";
  const minRating = minRatingParam ? Number(minRatingParam) : undefined;
  const parsedLibraryId = Number(libraryParam);
  const parsedListId = Number(listIdParam);
  const selectedLibraryId =
    libraryParam && Number.isInteger(parsedLibraryId) && parsedLibraryId > 0
      ? parsedLibraryId
      : undefined;
  const selectedListId =
    listIdParam && Number.isInteger(parsedListId) && parsedListId > 0 ? parsedListId : undefined;

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
    queryKey: [
      "books",
      {
        libraryId: selectedLibraryId ?? "all",
        listId: selectedListId ?? "all",
        q,
        genre,
        collection,
        authorCountry,
        readingStatus,
        minRating,
      },
    ],
    queryFn: () =>
      fetchBooks(token ?? "", {
        libraryId: selectedLibraryId,
        listId: selectedListId,
        q,
        genre: genre || undefined,
        collection: collection || undefined,
        authorCountry: authorCountry || undefined,
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
      setAddToListError(error instanceof Error ? error.message : "No se pudo anadir el libro a la lista.");
    },
  });

  const libraryMap = new Map(libraries.map((library) => [library.id, library]));
  const visibleLists = listsQuery.data ?? [];
  const activeList = visibleLists.find((list) => list.id === selectedListId) ?? null;
  const showLibraryBadge = libraries.length > 1;
  const defaultCreateLibraryId =
    editableLibraries.find((library) => library.id === activeLibraryId)?.id ??
    editableLibraries[0]?.id ??
    null;
  const booksErrorMessage =
    booksQuery.error instanceof Error ? booksQuery.error.message : "No se pudo cargar el catalogo.";

  function updateFilter(
    key: "library" | "listId" | "genre" | "collection" | "authorCountry" | "readingStatus" | "minRating",
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
      throw new Error("Selecciona una biblioteca valida para guardar el libro.");
    }

    const payload: BookCreatePayload = {
      library_id: libraryId,
      title: values.title.trim(),
      authors: [values.author.trim()],
      author_sex: values.authorSex || null,
      author_country_name: values.authorCountry.trim() || null,
      publication_year: values.publicationYear.trim() ? Number(values.publicationYear) : null,
      isbn: values.isbn.trim() || null,
      genres: values.genre.trim() ? [values.genre.trim()] : [],
      collection_name: values.collection.trim() || null,
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
          <p className="eyebrow">Catalogo privado</p>
          <h2>Mi catalogo</h2>
          <p>Explora tus libros, busca por autor o ISBN y manten el estado de lectura al dia.</p>
        </div>
        <button
          className="submit-button catalog-add-button"
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isLibrariesLoading || isLibrariesError || editableLibraries.length === 0}
        >
          + Anadir libro
        </button>
      </div>

      <div className="panel catalog-toolbar">
        <div className="catalog-search-block">
          <label className="field-group">
            Buscar
            <input
              placeholder="Buscar por titulo, autor, ISBN..."
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
            Lista
            <select value={listIdParam} onChange={(event) => updateFilter("listId", event.target.value)}>
              <option value="">Todas</option>
              {visibleLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
              {selectedListId && !activeList && !listsQuery.isPending ? (
                <option value={selectedListId}>Lista no disponible</option>
              ) : null}
            </select>
          </label>

          <label className="field-group">
            Genero
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
            Coleccion
            <input value={collection} onChange={(event) => updateFilter("collection", event.target.value)} />
          </label>

          <label className="field-group">
            Pais del autor
            <input value={authorCountry} onChange={(event) => updateFilter("authorCountry", event.target.value)} />
          </label>

          <label className="field-group">
            Estado de lectura
            <select value={readingStatus} onChange={(event) => updateFilter("readingStatus", event.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="reading">Leyendo</option>
              <option value="finished">Leido</option>
            </select>
          </label>

          <label className="field-group">
            Valoracion minima
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

      {selectedListId ? (
        <div className="panel subtle-panel active-filter-panel">
          <div className="active-filter-copy">
            <p className="eyebrow">Lista activa</p>
            <h3>{activeList?.name ?? `Lista #${selectedListId}`}</h3>
            <p>
              {activeList
                ? `Mostrando los libros asociados a la lista ${activeList.name}.`
                : "La lista filtrada ya no esta disponible o no te pertenece."}
            </p>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={() => updateFilter("listId", "")}>
            Limpiar filtro
          </button>
        </div>
      ) : null}

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
        <div className="panel content-stack">
          <p>{booksErrorMessage}</p>
          {selectedListId ? (
            <div className="inline-actions">
              <button className="ghost-link compact-action" type="button" onClick={() => updateFilter("listId", "")}>
                Limpiar filtro de lista
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {booksQuery.data && booksQuery.data.length === 0 ? (
        <div className="panel empty-state">
          <h3>{selectedListId ? "La lista seleccionada esta vacia." : "No hay libros con esos filtros."}</h3>
          <p>
            {selectedListId
              ? 'Anade libros a esta lista desde el catalogo usando la accion "Anadir a lista".'
              : "Ajusta la busqueda o crea un nuevo libro para empezar a poblar tu catalogo."}
          </p>
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
