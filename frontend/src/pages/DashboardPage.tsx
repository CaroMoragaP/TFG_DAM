import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AddToListModal } from "../components/AddToListModal";
import { BookCard } from "../components/BookCard";
import { buildBookPayloadThemes, BookModal, type BookFormValues } from "../components/BookModal";
import { CatalogHero } from "../components/CatalogHero";
import { CatalogImportModal } from "../components/CatalogImportModal";
import { CatalogToolbar } from "../components/CatalogToolbar";
import { CopyEditModal, type CopyEditValues } from "../components/CopyEditModal";
import { useToast } from "../components/FeedbackProvider";
import { useLibraries } from "../libraries/useLibraries";
import { LITERARY_GENRE_OPTIONS } from "../lib/bookMetadata";
import {
  addBookToListRequest,
  commitCatalogImportRequest,
  createBookRequest,
  exportCatalogRequest,
  fetchBooks,
  fetchLists,
  fetchThemes,
  previewCatalogImportRequest,
  updateCopyRequest,
  type Book,
  type BookCreatePayload,
  type CatalogImportPreview,
  type CatalogImportPreviewRow,
  type UserList,
} from "../lib/api";

const BOOKS_PAGE_SIZE = 24;

export function DashboardPage() {
  const { token } = useAuth();
  const { notifySuccess } = useToast();
  const { isLibrariesError, isLibrariesLoading, libraries } = useLibraries();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookForListModal, setBookForListModal] = useState<Book | null>(null);
  const [addToListError, setAddToListError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<CatalogImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const libraryParam = searchParams.get("library") ?? "";
  const listIdParam = searchParams.get("listId") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const theme = searchParams.get("theme") ?? "";
  const collection = searchParams.get("collection") ?? "";
  const authorCountry = searchParams.get("authorCountry") ?? "";
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

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: () => fetchThemes(token ?? ""),
    enabled: Boolean(token),
  });

  const booksQuery = useInfiniteQuery({
    queryKey: [
      "books",
      {
        libraryId: selectedLibraryId ?? "all",
        listId: selectedListId ?? "all",
        q,
        genre,
        theme,
        collection,
        authorCountry,
      },
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBooks(token ?? "", {
        libraryId: selectedLibraryId,
        listId: selectedListId,
        q,
        genre: genre || undefined,
        theme: theme || undefined,
        collection: collection || undefined,
        authorCountry: authorCountry || undefined,
        limit: BOOKS_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
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
        queryClient.invalidateQueries({ queryKey: ["themes"] }),
      ]);
      setIsCreateModalOpen(false);
      notifySuccess("El libro se ha añadido al catálogo.");
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
      notifySuccess("El ejemplar se ha actualizado.");
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
      notifySuccess("El libro se ha guardado en la lista.");
    },
    onError: (error) => {
      setAddToListError(error instanceof Error ? error.message : "No se pudo anadir el libro a la lista.");
    },
  });

  const previewImportMutation = useMutation({
    mutationFn: ({ libraryId, file }: { libraryId: number; file: File }) =>
      previewCatalogImportRequest(token ?? "", libraryId, file),
    onSuccess: (preview) => {
      setImportPreview(preview);
      setImportError(null);
    },
    onError: (error) => {
      setImportError(error instanceof Error ? error.message : "No se pudo analizar el CSV.");
    },
  });

  const commitImportMutation = useMutation({
    mutationFn: ({ libraryId, rows }: { libraryId: number; rows: CatalogImportPreviewRow[] }) =>
      commitCatalogImportRequest(token ?? "", libraryId, rows),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["themes"] }),
      ]);
      setImportError(null);
      setImportPreview(null);
      setIsImportModalOpen(false);
      notifySuccess("La importación del catálogo se ha completado.");
    },
    onError: (error) => {
      setImportError(error instanceof Error ? error.message : "No se pudo completar la importacion.");
    },
  });

  const libraryMap = new Map(libraries.map((library) => [library.id, library]));
  const books = booksQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalBooks = booksQuery.data?.pages[0]?.total ?? 0;
  const visibleLists = listsQuery.data ?? [];
  const activeList = visibleLists.find((list) => list.id === selectedListId) ?? null;
  const showLibraryBadge = libraries.length > 1;
  const defaultCreateLibraryId = null;
  const booksErrorMessage =
    booksQuery.error instanceof Error ? booksQuery.error.message : "No se pudo cargar el catalogo.";

  function updateFilter(
    key: "library" | "listId" | "genre" | "theme" | "collection" | "authorCountry",
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

  function clearCatalogFilters() {
    const nextSearchParams = new URLSearchParams(searchParams);
    ["library", "listId", "genre", "theme", "collection", "authorCountry"].forEach((key) => {
      nextSearchParams.delete(key);
    });
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

    const primaryAuthorFirstName = values.authorFirstName.trim() || null;
    const primaryAuthorLastName = values.authorLastName.trim() || null;

    const payload: BookCreatePayload = {
      library_id: libraryId,
      title: values.title.trim(),
      primary_author_first_name: primaryAuthorFirstName,
      primary_author_last_name: primaryAuthorLastName,
      authors: [],
      author_sex: values.authorSex || null,
      author_country_name: values.authorCountry.trim() || null,
      publication_year: values.publicationYear.trim() ? Number(values.publicationYear) : null,
      isbn: values.isbn.trim() || null,
      publisher_name: values.publisherName.trim() || null,
      genre: values.genre.trim() || null,
      themes: buildBookPayloadThemes(values),
      collection_name: values.collection.trim() || null,
      cover_url: values.coverUrl.trim() || null,
      reading_status: "pending",
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

  async function handlePreviewImport(libraryId: number, file: File) {
    await previewImportMutation.mutateAsync({ libraryId, file });
  }

  async function handleConfirmImport(libraryId: number, rows: CatalogImportPreviewRow[]) {
    await commitImportMutation.mutateAsync({ libraryId, rows });
  }

  async function handleExportCatalog() {
    setIsExporting(true);
    setExportErrorMessage(null);
    try {
      const blob = await exportCatalogRequest(token ?? "", {
        libraryId: selectedLibraryId,
        listId: selectedListId,
        q,
        genre: genre || undefined,
        theme: theme || undefined,
        collection: collection || undefined,
        authorCountry: authorCountry || undefined,
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "catalogo.csv";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setExportErrorMessage(error instanceof Error ? error.message : "No se pudo exportar el catalogo.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="content-stack private-page-shell">
      <CatalogHero
        onImport={() => {
          setImportError(null);
          setImportPreview(null);
          setIsImportModalOpen(true);
        }}
        onExport={() => void handleExportCatalog()}
        onAddBook={() => {
          createBookMutation.reset();
          setIsCreateModalOpen(true);
        }}
        isImportDisabled={isLibrariesLoading || isLibrariesError || editableLibraries.length === 0}
        isExportDisabled={booksQuery.isPending || isExporting}
        isExporting={isExporting}
      />

      <CatalogToolbar
        searchDraft={searchDraft}
        onSearchChange={setSearchDraft}
        libraryParam={libraryParam}
        libraries={libraries}
        onLibraryChange={(value) => updateFilter("library", value)}
        listIdParam={listIdParam}
        lists={visibleLists}
        selectedListId={selectedListId}
        activeList={activeList}
        onListChange={(value) => updateFilter("listId", value)}
        genre={genre}
        genreOptions={LITERARY_GENRE_OPTIONS}
        onGenreChange={(value) => updateFilter("genre", value)}
        theme={theme}
        themeOptions={themesQuery.data ?? []}
        onThemeChange={(value) => updateFilter("theme", value)}
        collection={collection}
        onCollectionChange={(value) => updateFilter("collection", value)}
        authorCountry={authorCountry}
        onAuthorCountryChange={(value) => updateFilter("authorCountry", value)}
        onClearFilters={clearCatalogFilters}
      />

      {selectedListId ? (
        <div className="panel dashboard-active-list-panel">
          <div className="dashboard-active-list-copy">
            <p className="eyebrow">Lista activa</p>
            <h3>{activeList?.name ?? `Lista #${selectedListId}`}</h3>
            <p>
              {activeList
                ? `Mostrando los libros asociados a la lista ${activeList.name}.`
                : "La lista filtrada ya no esta disponible o no te pertenece."}
            </p>
          </div>
          <button
            className="dashboard-toolbar-clear"
            type="button"
            onClick={() => updateFilter("listId", "")}
          >
            Limpiar filtro
          </button>
        </div>
      ) : null}

      {isLibrariesError ? (
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas accesibles.</p>
        </div>
      ) : null}

      {exportErrorMessage ? (
        <div className="panel">
          <p className="form-error">{exportErrorMessage}</p>
        </div>
      ) : null}

      {booksQuery.data ? (
        <div className="dashboard-results-row">
          <p>
            <strong>{totalBooks}</strong> {totalBooks === 1 ? "libro encontrado" : "libros encontrados"}
            {books.length < totalBooks ? ` · ${books.length} cargados` : ""}
          </p>
        </div>
      ) : null}

      {booksQuery.isPending ? (
        <div className="catalog-grid dashboard-catalog-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dashboard-book-skeleton panel" aria-hidden="true">
              <div className="dashboard-book-skeleton-cover" />
              <div className="dashboard-book-skeleton-line dashboard-book-skeleton-line-title" />
              <div className="dashboard-book-skeleton-line" />
              <div className="dashboard-book-skeleton-stars" />
              <div className="dashboard-book-skeleton-line dashboard-book-skeleton-line-short" />
              <div className="dashboard-book-skeleton-actions" />
            </div>
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

      {booksQuery.data && totalBooks === 0 ? (
        <div className="panel dashboard-empty-state">
          <div className="dashboard-empty-state-mark" aria-hidden="true">
            <span />
          </div>
          <h3>{selectedListId ? "La lista seleccionada esta vacia." : "No hay libros con esos filtros."}</h3>
          <p>
            {selectedListId
              ? 'Añade libros a esta lista desde el catálogo usando la acción "Añadir a lista".'
              : "Ajusta la busqueda o crea un nuevo libro para empezar a poblar tu catalogo."}
          </p>
          {!selectedListId ? (
            <button
              className="dashboard-card-button dashboard-card-button-primary"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={isLibrariesLoading || isLibrariesError || editableLibraries.length === 0}
            >
              Añadir primer libro
            </button>
          ) : null}
        </div>
      ) : null}

      {booksQuery.data && books.length > 0 ? (
        <div className="content-stack">
          <div className="catalog-grid dashboard-catalog-grid">
            {books.map((book) => {
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
          {booksQuery.hasNextPage ? (
            <div className="inline-actions">
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={() => void booksQuery.fetchNextPage()}
                disabled={booksQuery.isFetchingNextPage}
              >
                {booksQuery.isFetchingNextPage ? "Cargando..." : "Cargar más libros"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <BookModal
        book={null}
        defaultLibraryId={defaultCreateLibraryId}
        themeOptions={themesQuery.data ?? []}
        isOpen={isCreateModalOpen}
        isSaving={createBookMutation.isPending}
        libraries={editableLibraries}
        mode="create"
        onClose={() => {
          if (createBookMutation.isPending) {
            return;
          }
          createBookMutation.reset();
          setIsCreateModalOpen(false);
        }}
        onSubmit={handleSubmitBook}
        token={token ?? ""}
      />

      <CatalogImportModal
        defaultLibraryId={defaultCreateLibraryId}
        errorMessage={importError}
        isImporting={commitImportMutation.isPending}
        isOpen={isImportModalOpen}
        isPreviewing={previewImportMutation.isPending}
        libraries={editableLibraries}
        preview={importPreview}
        onClose={() => {
          if (previewImportMutation.isPending || commitImportMutation.isPending) {
            return;
          }
          setIsImportModalOpen(false);
          setImportPreview(null);
          setImportError(null);
        }}
        onConfirm={handleConfirmImport}
        onPreview={handlePreviewImport}
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
