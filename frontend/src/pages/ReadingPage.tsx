import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookCover } from "../components/BookCover";
import { DashboardHero } from "../components/DashboardHero";
import { useConfirm, useToast } from "../components/FeedbackProvider";
import { useLibraries } from "../libraries/useLibraries";
import {
  createCopyReviewRequest,
  deleteReviewRequest,
  fetchReadingShelf,
  updateReviewRequest,
  updateUserCopyDataRequest,
  type Library,
  type PublicReview,
  type ReadingShelfItem,
  type ReadingStatus,
  type UserCopyUpdatePayload,
} from "../lib/api";
import { readingStatusSectionLabels, readingStatusValueLabels } from "../lib/labels";
import { deriveReadingStatusFromDates } from "../lib/readingProgress";
import { normalizeLibraryFilterParam, normalizePositiveIntegerParam } from "../lib/urlParams";

type ReadingTab = ReadingStatus;
type ReadingSort =
  | "title"
  | "author"
  | "recent-start"
  | "oldest-start"
  | "recent-finish"
  | "oldest-finish"
  | "rating";

type EditorState = {
  readingStatus: ReadingStatus;
  rating: number | null;
  startDate: string;
  endDate: string;
  personalNotes: string;
  publicReviewBody: string;
};

const statusDescriptions: Record<ReadingStatus, string> = {
  pending: "Libros guardados para mas adelante, sin empezar todavia.",
  reading: "Lecturas activas con seguimiento de fechas, notas y valoracion.",
  finished: "Historial de lecturas terminadas y ya valoradas.",
};

const statusEyebrows: Record<ReadingStatus, string> = {
  pending: "Backlog personal",
  reading: "En curso",
  finished: "Historial lector",
};

const sortOptionsByTab: Record<ReadingTab, Array<{ value: ReadingSort; label: string }>> = {
  pending: [
    { value: "title", label: "Titulo A-Z" },
    { value: "author", label: "Autor A-Z" },
  ],
  reading: [
    { value: "recent-start", label: "Inicio mas reciente" },
    { value: "oldest-start", label: "Inicio mas antiguo" },
    { value: "title", label: "Titulo A-Z" },
    { value: "author", label: "Autor A-Z" },
    { value: "rating", label: "Mejor valorados" },
  ],
  finished: [
    { value: "recent-finish", label: "Finalizados recientemente" },
    { value: "oldest-finish", label: "Finalizados mas antiguos" },
    { value: "rating", label: "Mejor valorados" },
    { value: "title", label: "Titulo A-Z" },
    { value: "author", label: "Autor A-Z" },
  ],
};

const readingTabSequence: ReadingTab[] = ["pending", "reading", "finished"];
const READING_PAGE_SIZE = 20;
const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function getTodayInputValue() {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTab(value: string | null): ReadingTab {
  if (value === "pending" || value === "finished") {
    return value;
  }
  return "reading";
}

function normalizeCopyValue(value: string | null) {
  return normalizePositiveIntegerParam(value);
}

function getDefaultSort(tab: ReadingTab): ReadingSort {
  if (tab === "pending") {
    return "title";
  }
  if (tab === "finished") {
    return "recent-finish";
  }
  return "recent-start";
}

function buildEditorState(item: ReadingShelfItem): EditorState {
  return {
    readingStatus: item.reading_status,
    rating: item.rating,
    startDate: item.start_date ?? "",
    endDate: item.end_date ?? "",
    personalNotes: item.personal_notes ?? "",
    publicReviewBody: item.my_public_review?.body ?? "",
  };
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return longDateFormatter.format(new Date(value));
}

function formatCommunityRating(value: number | null) {
  return value === null ? "Sin media publica" : `${value.toFixed(1)}/5`;
}

function normalizeReviewBody(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildUpdatePayload(originalItem: ReadingShelfItem, editorState: EditorState): UserCopyUpdatePayload {
  const payload: UserCopyUpdatePayload = {};

  if (editorState.readingStatus !== originalItem.reading_status) {
    payload.reading_status = editorState.readingStatus;
  }
  if (editorState.rating !== originalItem.rating) {
    payload.rating = editorState.rating;
  }
  if (editorState.startDate !== (originalItem.start_date ?? "")) {
    payload.start_date = editorState.startDate || null;
  }
  if (editorState.endDate !== (originalItem.end_date ?? "")) {
    payload.end_date = editorState.endDate || null;
  }
  if (editorState.personalNotes !== (originalItem.personal_notes ?? "")) {
    payload.personal_notes = editorState.personalNotes;
  }

  return payload;
}

function hasChanges(payload: UserCopyUpdatePayload) {
  return Object.keys(payload).length > 0;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M10.5 4.25a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm0 1.5a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5Zm6.97 9.91 2.78 2.78a.75.75 0 1 1-1.06 1.06l-2.78-2.78a.75.75 0 1 1 1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 7.25a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 4 7.25Zm8.5 0A.75.75 0 0 1 13.25 6.5h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M9.75 4.5a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
      <path
        d="M4 16.75a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm13.5 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M16.25 14a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={isExpanded ? "is-expanded" : ""}>
      <path
        d="m7.72 14.78 3.75-3.75a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 1 1-1.06 1.06L12 12.62l-3.22 3.22a.75.75 0 1 1-1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getLibraryForItem(libraries: Library[], item: ReadingShelfItem) {
  return libraries.find((candidate) => candidate.id === item.library_id) ?? null;
}

export function ReadingPage() {
  const { token } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { notifySuccess } = useToast();
  const { isLibrariesError, isLibrariesLoading, libraries } = useLibraries();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<ReadingSort>(() => getDefaultSort(normalizeTab(searchParams.get("tab"))));
  const [editingCopyId, setEditingCopyId] = useState<number | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const autoOpenedCopyIdRef = useRef<number | null>(null);

  const q = searchParams.get("q") ?? "";
  const tab = normalizeTab(searchParams.get("tab"));
  const libraryValue = normalizeLibraryFilterParam(searchParams.get("library"));
  const selectedCopyId = normalizeCopyValue(searchParams.get("copy"));
  const selectedLibraryId = libraryValue === "all" ? undefined : Number(libraryValue);
  const availableLibraries = libraries.filter((library) => !library.is_archived);
  const normalizedSearchQuery = searchDraft.trim();
  const defaultSort = getDefaultSort(tab);
  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (selectedCopyId !== null) {
      count += 1;
    }
    if (libraryValue !== "all") {
      count += 1;
    }
    if (sort !== defaultSort) {
      count += 1;
    }

    return count;
  }, [defaultSort, libraryValue, selectedCopyId, sort]);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(activeFilterCount > 0);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    const nextLibrary = searchParams.get("library");

    if (nextTab && nextLibrary) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    if (!nextTab) {
      nextSearchParams.set("tab", tab);
    }
    if (!nextLibrary) {
      nextSearchParams.set("library", libraryValue);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }, [libraryValue, searchParams, setSearchParams, tab]);

  useEffect(() => {
    setSort(getDefaultSort(tab));
  }, [tab]);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setIsFiltersExpanded(true);
    }
  }, [activeFilterCount]);

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

  const readingQuery = useInfiniteQuery({
    queryKey: ["reading-shelf", selectedLibraryId ?? "all", tab, q, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchReadingShelf(token ?? "", {
        libraryId: selectedLibraryId,
        q,
        readingStatus: tab,
        sort,
        limit: READING_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: Boolean(token),
  });
  const selectedItemQuery = useQuery({
    queryKey: ["reading-shelf", "selected", selectedCopyId ?? null],
    queryFn: () =>
      fetchReadingShelf(token ?? "", {
        copyId: selectedCopyId ?? undefined,
        limit: 1,
        offset: 0,
      }),
    enabled: Boolean(token && selectedCopyId !== null),
  });

  const updateReadingMutation = useMutation({
    mutationFn: ({
      copyId,
      payload,
    }: {
      copyId: number;
      payload: UserCopyUpdatePayload;
    }) => updateUserCopyDataRequest(token ?? "", copyId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reading-shelf"] }),
        queryClient.invalidateQueries({ queryKey: ["copy-user-data"] }),
        queryClient.invalidateQueries({ queryKey: ["copy-community"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["library-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["library-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["stats", "reading"] }),
      ]);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      copyId,
      existingReview,
      body,
    }: {
      copyId: number;
      existingReview: PublicReview | null;
      body: string | null;
    }) => {
      if (existingReview) {
        return updateReviewRequest(token ?? "", existingReview.id, { body });
      }

      return createCopyReviewRequest(token ?? "", copyId, { body });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reading-shelf"] }),
        queryClient.invalidateQueries({ queryKey: ["copy-community"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["library-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["library-reviews"] }),
      ]);
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: number) => deleteReviewRequest(token ?? "", reviewId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reading-shelf"] }),
        queryClient.invalidateQueries({ queryKey: ["copy-community"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["library-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["library-reviews"] }),
      ]);
    },
  });

  const shelfItems = readingQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = readingQuery.data?.pages[0]?.status_counts ?? {
    pending: 0,
    reading: 0,
    finished: 0,
  };
  const totalShelfItems = readingQuery.data?.pages[0]?.total ?? 0;
  const selectedItem = selectedItemQuery.data?.items[0] ?? null;
  const visibleItems = selectedItem ? [selectedItem] : shelfItems;

  const showLibraryBadge = availableLibraries.length > 1;
  const readingError = selectedCopyId !== null && selectedItemQuery.isError ? selectedItemQuery.error : readingQuery.error;
  const errorMessage =
    readingError instanceof Error ? readingError.message : "No se pudieron cargar tus lecturas.";
  const saveReadingErrorMessage =
    updateReadingMutation.isError
      ? updateReadingMutation.error instanceof Error
        ? updateReadingMutation.error.message
        : "No se pudieron guardar los cambios de lectura."
      : null;

  const updateSearchParam = useCallback(
    (key: "tab" | "library" | "copy" | "q", value: string | null) => {
      setSearchParams((currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);
        if (value === null) {
          nextSearchParams.delete(key);
        } else {
          nextSearchParams.set(key, value);
        }
        return nextSearchParams;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (selectedCopyId === null) {
      autoOpenedCopyIdRef.current = null;
      return;
    }

    if (!selectedCopyId || selectedItemQuery.isPending) {
      return;
    }

    const targetItem = selectedItem;
    if (!targetItem) {
      updateSearchParam("copy", null);
      return;
    }

    if (libraryValue !== "all" && selectedLibraryId !== targetItem.library_id) {
      updateSearchParam("library", String(targetItem.library_id));
      return;
    }

    if (autoOpenedCopyIdRef.current === targetItem.copy_id) {
      return;
    }

    autoOpenedCopyIdRef.current = targetItem.copy_id;
    setEditingCopyId(targetItem.copy_id);
    setEditorState(buildEditorState(targetItem));
  }, [libraryValue, selectedCopyId, selectedItem, selectedItemQuery.isPending, selectedLibraryId, updateSearchParam]);

  function handleOpenEditor(item: ReadingShelfItem) {
    updateReadingMutation.reset();
    reviewMutation.reset();
    deleteReviewMutation.reset();

    if (editingCopyId === item.copy_id) {
      setEditingCopyId(null);
      setEditorState(null);
      return;
    }

    setEditingCopyId(item.copy_id);
    setEditorState(buildEditorState(item));
  }

  async function persistReadingChanges(item: ReadingShelfItem) {
    if (!editorState) {
      return false;
    }

    const payload = buildUpdatePayload(item, editorState);
    if (!hasChanges(payload)) {
      return false;
    }

    await updateReadingMutation.mutateAsync({
      copyId: item.copy_id,
      payload,
    });
    return true;
  }

  async function handleSaveEditor(item: ReadingShelfItem) {
    try {
      const didPersistChanges = await persistReadingChanges(item);
      setEditingCopyId(null);
      setEditorState(null);

      if (didPersistChanges) {
        notifySuccess("La lectura se ha guardado.");
      }
    } catch {
      // The mutation already exposes the inline error state next to the save action.
    }
  }

  async function handlePublishReview(item: ReadingShelfItem) {
    if (!editorState || editorState.rating === null) {
      return;
    }

    try {
      const existingReview = item.my_public_review;
      const nextBody = normalizeReviewBody(editorState.publicReviewBody);
      const currentBody = normalizeReviewBody(existingReview?.body ?? "");

      const didPersistReadingChanges = await persistReadingChanges(item);

    if (existingReview && nextBody === currentBody) {
      if (didPersistReadingChanges) {
        notifySuccess("Tu valoración personal se ha actualizado.");
      }
      return;
    }

    await reviewMutation.mutateAsync({
      copyId: item.copy_id,
      existingReview,
      body: nextBody,
    });
    notifySuccess(existingReview ? "La publicación pública se ha actualizado." : "La valoración se ha publicado en el muro.");
    } catch {
      // The review mutation keeps its own inline error feedback inside the shared panel.
    }
  }

  async function handleDeleteReview(item: ReadingShelfItem) {
    if (!item.my_public_review) {
      return;
    }

    const isConfirmed = await confirm({
      title: "Retirar publicación pública",
      description: "Tu reseña dejará de aparecer en la comunidad para este ejemplar.",
      confirmLabel: "Retirar publicación",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!isConfirmed) {
      return;
    }

    try {
    await deleteReviewMutation.mutateAsync(item.my_public_review.id);
    notifySuccess("La publicación pública se ha retirado.");
    } catch {
      // The mutation surfaces its error inline in the publication block.
    }
  }

  async function handleReadingStatusChange(nextStatus: ReadingStatus) {
    if (nextStatus === "reading" && editorState?.endDate) {
      const isConfirmed = await confirm({
        title: "Iniciar una relectura",
        description: "El libro ya figura como terminado. Se limpiará la fecha de fin actual para dejarlo de nuevo en curso.",
        confirmLabel: "Marcar relectura",
        cancelLabel: "Mantener como leído",
      });
      if (!isConfirmed) {
        return;
      }
    }

    setEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      if (nextStatus === "pending") {
        return {
          ...currentState,
          readingStatus: "pending",
          startDate: "",
          endDate: "",
        };
      }

      if (nextStatus === "reading") {
        return {
          ...currentState,
          readingStatus: "reading",
          startDate: currentState.startDate || getTodayInputValue(),
          endDate: "",
        };
      }

      return {
        ...currentState,
        readingStatus: "finished",
        endDate: currentState.endDate || getTodayInputValue(),
      };
    });
  }

  function handleStartDateChange(nextStartDate: string) {
    setEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      const nextEndDate = nextStartDate && currentState.endDate ? "" : currentState.endDate;
      return {
        ...currentState,
        startDate: nextStartDate,
        endDate: nextEndDate,
        readingStatus: deriveReadingStatusFromDates(currentState.readingStatus, nextStartDate, nextEndDate),
      };
    });
  }

  function handleEndDateChange(nextEndDate: string) {
    setEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        endDate: nextEndDate,
        readingStatus: deriveReadingStatusFromDates(currentState.readingStatus, currentState.startDate, nextEndDate),
      };
    });
  }

  async function handleReadingStatusSelect(nextStatus: ReadingStatus) {
    if (nextStatus === "reading" && editorState?.endDate) {
      const isConfirmed = await confirm({
        title: "Iniciar una relectura",
        description: "El libro ya figura como terminado. Se limpiará la fecha de fin actual para dejarlo de nuevo en curso.",
        confirmLabel: "Marcar relectura",
        cancelLabel: "Mantener como leído",
      });
      if (!isConfirmed) {
        return;
      }

      setEditorState((currentState) =>
        currentState
          ? {
              ...currentState,
              readingStatus: "reading",
              startDate: currentState.startDate || getTodayInputValue(),
              endDate: "",
            }
          : currentState,
      );
      return;
    }

    handleReadingStatusChange(nextStatus);
  }

  async function handleStartDateInput(nextStartDate: string) {
    if (nextStartDate && editorState?.endDate) {
      const isConfirmed = await confirm({
        title: "Iniciar una relectura",
        description: "La fecha de fin actual se borrará para dejar este libro de nuevo en curso.",
        confirmLabel: "Continuar",
        cancelLabel: "Cancelar",
      });
      if (!isConfirmed) {
        return;
      }

      setEditorState((currentState) =>
        currentState
          ? {
              ...currentState,
              startDate: nextStartDate,
              endDate: "",
              readingStatus: deriveReadingStatusFromDates(currentState.readingStatus, nextStartDate, ""),
            }
          : currentState,
      );
      return;
    }

    handleStartDateChange(nextStartDate);
  }

  return (
    <section className="content-stack private-page-shell">
      <DashboardHero
        eyebrow="Seguimiento lector"
        title="Mi registro de lectura"
        description="Gestiona tu progreso lector, anota impresiones personales y publica tu valoracion en las bibliotecas compartidas sin duplicar notas."
        icon="reading"
      />

      <div className="reading-count-grid">
        {readingTabSequence.map((status) => (
          <article key={status} className="panel reading-count-card">
            <p className="eyebrow">{statusEyebrows[status]}</p>
            <strong>{counts[status]}</strong>
            <span>{readingStatusSectionLabels[status]}</span>
          </article>
        ))}
      </div>

      <div className="panel dashboard-toolbar reading-toolbar">
        <div className="dashboard-toolbar-top">
          <label className="dashboard-search-shell reading-search-shell">
            <span className="dashboard-search-icon">
              <SearchIcon />
            </span>
            <input
              aria-label="Buscar lecturas"
              placeholder="Buscar por titulo, autor o coleccion..."
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>

          <button
            className={`dashboard-filter-toggle${isFiltersExpanded ? " is-open" : ""}`}
            type="button"
            aria-expanded={isFiltersExpanded}
            aria-controls="reading-filters-panel"
            onClick={() => setIsFiltersExpanded((currentValue) => !currentValue)}
          >
            <span className="dashboard-filter-toggle-main">
              <span className="dashboard-filter-toggle-icon">
                <SlidersIcon />
              </span>
              <span>Filtros</span>
            </span>
            <span className="dashboard-filter-toggle-side">
              {activeFilterCount > 0 ? (
                <span className="dashboard-filter-toggle-count">{activeFilterCount}</span>
              ) : null}
              <ChevronIcon isExpanded={isFiltersExpanded} />
            </span>
          </button>
        </div>

        {isFiltersExpanded ? (
          <div id="reading-filters-panel" className="dashboard-filters-shell">
            <div className="dashboard-filters-grid reading-filters-grid">
              <label className="dashboard-filter-field">
                <span>Biblioteca</span>
                <select
                  value={libraryValue}
                  onChange={(event) => updateSearchParam("library", event.target.value)}
                  disabled={isLibrariesLoading}
                >
                  <option value="all">Todas mis bibliotecas</option>
                  {availableLibraries.map((library) => (
                    <option key={library.id} value={library.id}>
                      {library.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dashboard-filter-field">
                <span>Ordenar por</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as ReadingSort)}>
                  {sortOptionsByTab[tab].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeFilterCount > 0 ? (
              <div className="dashboard-filters-footer">
                <button
                  className="dashboard-toolbar-clear"
                  type="button"
                  onClick={() => {
                    updateSearchParam("copy", null);
                    updateSearchParam("library", "all");
                    setSort(defaultSort);
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="reading-tab-strip" role="tablist" aria-label="Estados de lectura">
          {readingTabSequence.map((status) => (
            <button
              key={status}
              className={status === tab ? "stats-tab active" : "stats-tab"}
              type="button"
              onClick={() => {
                setSort(getDefaultSort(status));
                updateSearchParam("tab", status);
              }}
            >
              {readingStatusSectionLabels[status]}
            </button>
          ))}
        </div>
      </div>

      {selectedItem ? (
        <div className="panel active-filter-panel">
          <div className="active-filter-copy">
            <h3>Mostrando solo el libro seleccionado</h3>
            <p>
              {selectedItem.title} · {selectedItem.authors[0] ?? "Autor sin registrar"}
            </p>
            <p>Quita este filtro para volver a ver todo el listado del tab actual.</p>
          </div>
          <button
            className="ghost-link compact-action"
            type="button"
            onClick={() => updateSearchParam("copy", null)}
          >
            Quitar filtro
          </button>
        </div>
      ) : null}

      {isLibrariesError ? (
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas disponibles para esta vista.</p>
        </div>
      ) : null}

      {readingQuery.data && selectedCopyId === null ? (
        <div className="dashboard-results-row">
          <p>
            <strong>{totalShelfItems}</strong> {totalShelfItems === 1 ? "libro en esta vista" : "libros en esta vista"}
            {visibleItems.length < totalShelfItems ? ` · ${visibleItems.length} cargados` : ""}
          </p>
        </div>
      ) : null}

      {readingQuery.isPending && selectedItem === null ? (
        <div className="content-stack">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="book-skeleton panel" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {(readingQuery.isError || selectedItemQuery.isError) ? (
        <div className="panel">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {!readingQuery.isPending &&
      !readingQuery.isError &&
      !selectedItemQuery.isError &&
      selectedCopyId === null &&
      visibleItems.length === 0 ? (
        <div className="panel empty-state">
          <h3>
            {normalizedSearchQuery
              ? "No hay resultados para esa busqueda."
              : `No hay libros en ${readingStatusSectionLabels[tab].toLowerCase()}.`}
          </h3>
          <p>
            {normalizedSearchQuery
              ? "Prueba con otro titulo, autor o coleccion, o limpia la busqueda actual."
              : statusDescriptions[tab]}
          </p>
          <div className="inline-actions">
            <Link className="ghost-link compact-action" to="/catalogo">
              Ir al catalogo
            </Link>
            {normalizedSearchQuery ? (
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={() => {
                  setSearchDraft("");
                  updateSearchParam("q", null);
                }}
              >
                Limpiar busqueda
              </button>
            ) : null}
            {tab === "pending" ? (
              <Link className="ghost-link compact-action" to="/listas">
                Abrir Mis listas
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!readingQuery.isPending && !readingQuery.isError && !selectedItemQuery.isError && visibleItems.length > 0 ? (
        <div className="content-stack">
          {visibleItems.map((item) => {
            const library = getLibraryForItem(libraries, item);
            const isEditing = editingCopyId === item.copy_id && editorState !== null;
            const isSharedItem = library?.type === "shared";

            return (
              <article key={item.copy_id} className="panel reading-entry-card">
                <div className="reading-entry-layout">
                  <div className="reading-entry-cover">
                    <BookCover title={item.title} coverUrl={item.cover_url} />
                  </div>

                  <div className="reading-entry-content">
                    <div className="reading-entry-head">
                      <div>
                        <h3>{item.title}</h3>
                        <p className="book-card-author">{item.authors[0] ?? "Autor sin registrar"}</p>
                      </div>

                      <div className="card-actions">
                        <button
                          className="ghost-link compact-action"
                          type="button"
                          onClick={() => handleOpenEditor(item)}
                        >
                          {isEditing ? "Cerrar editor" : "Gestionar lectura"}
                        </button>
                        <Link className="ghost-link compact-action" to={`/ejemplar/${item.copy_id}`}>
                          Abrir ficha
                        </Link>
                      </div>
                    </div>

                    <dl className="reading-entry-meta">
                      <div>
                        <dt>Valoracion</dt>
                        <dd>{item.rating ? `${item.rating}/5` : "-"}</dd>
                      </div>
                      <div>
                        <dt>{tab === "finished" ? "Fecha fin" : "Fecha inicio"}</dt>
                        <dd>{formatDateLabel(tab === "finished" ? item.end_date : item.start_date)}</dd>
                      </div>
                      <div>
                        <dt>Coleccion</dt>
                        <dd>{item.collection ?? "-"}</dd>
                      </div>
                    </dl>

                    <div className={item.personal_notes ? "reading-entry-footer has-notes" : "reading-entry-footer"}>
                      <div className="reading-entry-badges">
                        {showLibraryBadge && library ? <span className="library-badge">{library.name}</span> : null}
                        {item.my_public_review ? <span className="status-chip active">Publicada</span> : null}
                        {isSharedItem && item.public_review_count > 0 ? (
                          <span className="status-chip">
                            {item.public_review_count} resenas · {formatCommunityRating(item.public_average_rating)}
                          </span>
                        ) : null}
                      </div>
                      {item.personal_notes ? <p className="reading-notes-preview">{item.personal_notes}</p> : null}
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="reading-editor-panel">
                    <div className="reading-editor-header">
                      <div>
                        <p className="eyebrow">Edicion principal</p>
                        <h4>Mi lectura</h4>
                      </div>
                      <span className="status-chip">{readingStatusValueLabels[editorState.readingStatus]}</span>
                    </div>

                    <div className="modal-grid">
                      <label className="field-group">
                        Estado de lectura
                        <select
                          value={editorState.readingStatus}
                          onChange={(event) => {
                            void handleReadingStatusSelect(event.target.value as ReadingStatus);
                          }}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="reading">Leyendo</option>
                          <option value="finished">Leído</option>
                        </select>
                      </label>

                      <div className="rating-block">
                        <span className="eyebrow">Valoracion</span>
                        <div className="star-row" role="group" aria-label={`Valorar ${item.title}`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              className={star <= (editorState.rating ?? 0) ? "star-button active" : "star-button"}
                              type="button"
                              aria-label={`Valorar ${item.title} con ${star} estrellas`}
                              onClick={() =>
                                setEditorState((currentState) =>
                                  currentState
                                    ? {
                                        ...currentState,
                                        rating: currentState.rating === star ? null : star,
                                      }
                                    : currentState,
                                )
                              }
                            >
                              *
                            </button>
                          ))}
                        </div>
                        <p className="detail-inline-copy">
                          {editorState.rating ? `${editorState.rating}/5` : "Sin valoracion"}
                        </p>
                      </div>

                      <label className="field-group">
                        Fecha de inicio
                        <input
                          type="date"
                          value={editorState.startDate}
                          onChange={(event) => {
                            void handleStartDateInput(event.target.value);
                          }}
                        />
                      </label>

                      <label className="field-group">
                        Fecha de fin
                        <input
                          type="date"
                          value={editorState.endDate}
                          onChange={(event) => handleEndDateChange(event.target.value)}
                        />
                      </label>

                      <label className="field-group field-span-full">
                        Notas personales
                        <textarea
                          className="notes-textarea"
                          rows={5}
                          value={editorState.personalNotes}
                          onChange={(event) =>
                            setEditorState((currentState) =>
                              currentState
                                ? { ...currentState, personalNotes: event.target.value }
                                : currentState,
                            )
                          }
                        />
                      </label>
                    </div>

                    {isSharedItem ? (
                      <div className="reading-community-panel">
                        <div className="reading-community-header">
                          <div>
                            <p className="eyebrow">Mi valoracion y publicacion</p>
                            <h4>Publica la misma nota que usas para tu seguimiento</h4>
                          </div>
                          <div className="community-stat-row">
                            <span className="status-chip active">{item.public_review_count} resenas</span>
                            <span className="status-chip">{formatCommunityRating(item.public_average_rating)}</span>
                          </div>
                        </div>

                        <p className="detail-inline-copy">
                          Tu valoracion personal es la nota canonica. Si la publicas, la comunidad vera esa misma
                          puntuacion junto con tu comentario opcional.
                        </p>

                        <label className="field-group">
                          Comentario publico
                          <textarea
                            className="notes-textarea"
                            rows={4}
                            value={editorState.publicReviewBody}
                            onChange={(event) =>
                              setEditorState((currentState) =>
                                currentState
                                  ? { ...currentState, publicReviewBody: event.target.value }
                                  : currentState,
                              )
                            }
                            placeholder="Comparte por que merece la pena leerlo..."
                          />
                        </label>

                        <div className="inline-actions">
                          <button
                            className="submit-button compact-button"
                            type="button"
                            onClick={() => void handlePublishReview(item)}
                            disabled={
                              reviewMutation.isPending || updateReadingMutation.isPending || editorState.rating === null
                            }
                          >
                            {item.my_public_review ? "Actualizar publicacion" : "Publicar mi valoracion"}
                          </button>
                          {item.my_public_review ? (
                            <button
                              className="ghost-link compact-action"
                              type="button"
                              onClick={() => void handleDeleteReview(item)}
                              disabled={deleteReviewMutation.isPending}
                            >
                              Retirar publicacion
                            </button>
                          ) : null}
                          <Link className="ghost-link compact-action" to={`/muro?tab=reviews&library=${item.library_id}`}>
                            Ver en el muro
                          </Link>
                        </div>

                        {editorState.rating === null ? (
                          <p className="detail-inline-copy">Guarda una nota para poder publicar esta valoracion.</p>
                        ) : null}
                        {reviewMutation.isError ? (
                          <p className="form-error">
                            {reviewMutation.error instanceof Error
                              ? reviewMutation.error.message
                              : "No se pudo publicar la valoracion."}
                          </p>
                        ) : null}
                        {deleteReviewMutation.isError ? (
                          <p className="form-error">
                            {deleteReviewMutation.error instanceof Error
                              ? deleteReviewMutation.error.message
                              : "No se pudo retirar la publicacion."}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {saveReadingErrorMessage ? (
                      <p className="form-error reading-save-error" role="alert">
                        {saveReadingErrorMessage}
                      </p>
                    ) : null}

                    <div className="inline-actions">
                      <button
                        className="submit-button compact-button"
                        type="button"
                        onClick={() => void handleSaveEditor(item)}
                        disabled={updateReadingMutation.isPending}
                      >
                        {updateReadingMutation.isPending ? "Guardando..." : "Guardar lectura"}
                      </button>
                      <button
                        className="ghost-link compact-action"
                        type="button"
                        onClick={() => {
                          updateReadingMutation.reset();
                          reviewMutation.reset();
                          deleteReviewMutation.reset();
                          setEditingCopyId(null);
                          setEditorState(null);
                        }}
                        disabled={updateReadingMutation.isPending}
                      >
                        Cancelar
                      </button>
                    </div>

                  </div>
                ) : null}
              </article>
            );
          })}
          {selectedItem === null && readingQuery.hasNextPage ? (
            <div className="inline-actions">
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={() => void readingQuery.fetchNextPage()}
                disabled={readingQuery.isFetchingNextPage}
              >
                {readingQuery.isFetchingNextPage ? "Cargando..." : "Cargar más lecturas"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
