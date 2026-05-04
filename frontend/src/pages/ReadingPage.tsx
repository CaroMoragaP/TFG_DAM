import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  fetchReadingShelf,
  updateUserCopyDataRequest,
  type ReadingShelfItem,
  type ReadingStatus,
  type UserCopyUpdatePayload,
} from "../lib/api";
import { deriveReadingStatusFromDates } from "../lib/readingProgress";

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
};

const statusLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  finished: "Leidos",
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
const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function normalizeTab(value: string | null): ReadingTab {
  if (value === "pending" || value === "finished") {
    return value;
  }
  return "reading";
}

function normalizeLibraryValue(value: string | null) {
  if (!value || value === "all") {
    return "all";
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "all";
  }

  return String(parsed);
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

function compareText(left: string, right: string) {
  return left.localeCompare(right, "es", { sensitivity: "base" });
}

function compareNullableDates(left: string | null, right: string | null, descending: boolean) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  const timeDifference = new Date(left).getTime() - new Date(right).getTime();
  return descending ? -timeDifference : timeDifference;
}

function compareNullableRatings(left: number | null, right: number | null) {
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

function sortReadingItems(items: ReadingShelfItem[], sort: ReadingSort) {
  const sorted = [...items];
  sorted.sort((left, right) => {
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
    if (sort === "recent-start") {
      const dateDifference = compareNullableDates(left.start_date, right.start_date, true);
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return compareText(left.title, right.title);
    }
    if (sort === "oldest-start") {
      const dateDifference = compareNullableDates(left.start_date, right.start_date, false);
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return compareText(left.title, right.title);
    }
    if (sort === "recent-finish") {
      const dateDifference = compareNullableDates(left.end_date, right.end_date, true);
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return compareText(left.title, right.title);
    }
    if (sort === "oldest-finish") {
      const dateDifference = compareNullableDates(left.end_date, right.end_date, false);
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return compareText(left.title, right.title);
    }

    const ratingDifference = compareNullableRatings(left.rating, right.rating);
    if (ratingDifference !== 0) {
      return ratingDifference;
    }
    return compareText(left.title, right.title);
  });

  return sorted;
}

function buildEditorState(item: ReadingShelfItem): EditorState {
  return {
    readingStatus: item.reading_status,
    rating: item.rating,
    startDate: item.start_date ?? "",
    endDate: item.end_date ?? "",
    personalNotes: item.personal_notes ?? "",
  };
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return longDateFormatter.format(new Date(value));
}

function buildUpdatePayload(
  originalItem: ReadingShelfItem,
  editorState: EditorState,
): UserCopyUpdatePayload {
  const payload: UserCopyUpdatePayload = {};
  const nextReadingStatus = deriveReadingStatusFromDates(
    editorState.readingStatus,
    editorState.startDate,
    editorState.endDate,
  );

  if (nextReadingStatus !== originalItem.reading_status) {
    payload.reading_status = nextReadingStatus;
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

function renderCover(item: ReadingShelfItem) {
  const coverLetter = (item.title.trim().slice(0, 1) || "?").toUpperCase();

  if (item.cover_url) {
    return <img className="book-cover-image" src={item.cover_url} alt={`Portada de ${item.title}`} />;
  }

  return (
    <div className="book-cover-placeholder" aria-hidden="true">
      <span>{coverLetter}</span>
    </div>
  );
}

export function ReadingPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { isLibrariesError, isLibrariesLoading, libraries } = useActiveLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState<ReadingSort>("recent-start");
  const [editingCopyId, setEditingCopyId] = useState<number | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const tab = normalizeTab(searchParams.get("tab"));
  const libraryValue = normalizeLibraryValue(searchParams.get("library"));
  const selectedLibraryId = libraryValue === "all" ? undefined : Number(libraryValue);
  const availableLibraries = libraries.filter((library) => !library.is_archived);

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
    setEditingCopyId(null);
    setEditorState(null);
  }, [tab]);

  const readingQuery = useQuery({
    queryKey: ["reading-shelf", selectedLibraryId ?? "all"],
    queryFn: () => fetchReadingShelf(token ?? "", { libraryId: selectedLibraryId }),
    enabled: Boolean(token),
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
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["stats", "reading"] }),
      ]);
      setEditingCopyId(null);
      setEditorState(null);
    },
  });

  const counts = useMemo(() => {
    return readingTabSequence.reduce(
      (accumulator, status) => {
        accumulator[status] = (readingQuery.data ?? []).filter((item) => item.reading_status === status).length;
        return accumulator;
      },
      {
        pending: 0,
        reading: 0,
        finished: 0,
      },
    );
  }, [readingQuery.data]);

  const filteredItems = useMemo(() => {
    const items = (readingQuery.data ?? []).filter((item) => item.reading_status === tab);
    return sortReadingItems(items, sort);
  }, [readingQuery.data, sort, tab]);

  const activeLibrary = selectedLibraryId
    ? availableLibraries.find((library) => library.id === selectedLibraryId) ?? null
    : null;
  const showLibraryBadge = availableLibraries.length > 1;
  const errorMessage =
    readingQuery.error instanceof Error
      ? readingQuery.error.message
      : "No se pudieron cargar tus lecturas.";

  function updateSearchParam(key: "tab" | "library", value: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(key, value);
    setSearchParams(nextSearchParams, { replace: true });
  }

  function handleOpenEditor(item: ReadingShelfItem) {
    if (editingCopyId === item.copy_id) {
      setEditingCopyId(null);
      setEditorState(null);
      return;
    }

    setEditingCopyId(item.copy_id);
    setEditorState(buildEditorState(item));
  }

  async function handleSaveEditor(item: ReadingShelfItem) {
    if (!editorState) {
      return;
    }

    const payload = buildUpdatePayload(item, editorState);
    if (!hasChanges(payload)) {
      setEditingCopyId(null);
      setEditorState(null);
      return;
    }

    await updateReadingMutation.mutateAsync({
      copyId: item.copy_id,
      payload,
    });
  }

  return (
    <section className="content-stack">
      <div className="panel hero-panel reading-hero">
        <div>
          <p className="eyebrow">Seguimiento lector</p>
          <h2>Lectura</h2>
          <p>
            Gestiona tu progreso lector, anota impresiones personales y mueve cada libro entre
            pendientes, lecturas activas e historial terminado.
          </p>
        </div>
        <div className="reading-hero-aside">
          <span className="status-chip active">{activeLibrary ? activeLibrary.name : "Todas tus bibliotecas"}</span>
          <p>
            Esta vista es tu espacio de trabajo diario. Las metricas y graficos se mantienen en
            Estadisticas.
          </p>
        </div>
      </div>

      <div className="reading-count-grid">
        {readingTabSequence.map((status) => (
          <article key={status} className="panel reading-count-card">
            <p className="eyebrow">{statusEyebrows[status]}</p>
            <strong>{counts[status]}</strong>
            <span>{statusLabels[status]}</span>
          </article>
        ))}
      </div>

      <div className="panel reading-toolbar">
        <label className="field-group">
          Biblioteca
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

        <label className="field-group">
          Ordenar por
          <select value={sort} onChange={(event) => setSort(event.target.value as ReadingSort)}>
            {sortOptionsByTab[tab].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="reading-tab-strip" role="tablist" aria-label="Estados de lectura">
          {readingTabSequence.map((status) => (
            <button
              key={status}
              className={status === tab ? "stats-tab active" : "stats-tab"}
              type="button"
              onClick={() => updateSearchParam("tab", status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>

      {tab === "pending" ? (
        <div className="panel subtle-panel reading-helper-panel">
          <div>
            <p className="eyebrow">Planificacion manual</p>
            <h3>Separado de tus listas personales</h3>
            <p>
              Esta pestana solo muestra libros sin empezar. Si quieres curar prioridades o selecciones
              propias, usa <Link className="ghost-link compact-action" to="/listas">Mis listas</Link>.
            </p>
          </div>
        </div>
      ) : null}

      {isLibrariesError ? (
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas disponibles para esta vista.</p>
        </div>
      ) : null}

      {readingQuery.isPending ? (
        <div className="content-stack">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="book-skeleton panel" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {readingQuery.isError ? (
        <div className="panel">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {!readingQuery.isPending && !readingQuery.isError && filteredItems.length === 0 ? (
        <div className="panel empty-state">
          <h3>No hay libros en {statusLabels[tab].toLowerCase()}.</h3>
          <p>{statusDescriptions[tab]}</p>
          <div className="inline-actions">
            <Link className="ghost-link compact-action" to="/catalogo">
              Ir al catalogo
            </Link>
            {tab === "pending" ? (
              <Link className="ghost-link compact-action" to="/listas">
                Abrir Mis listas
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!readingQuery.isPending && !readingQuery.isError && filteredItems.length > 0 ? (
        <div className="content-stack">
          {filteredItems.map((item) => {
            const library = libraries.find((candidate) => candidate.id === item.library_id) ?? null;
            const isEditing = editingCopyId === item.copy_id && editorState !== null;

            return (
              <article key={item.copy_id} className="panel reading-entry-card">
                <div className="reading-entry-layout">
                  <div className="reading-entry-cover">{renderCover(item)}</div>

                  <div className="reading-entry-content">
                    <div className="reading-entry-head">
                      <div>
                        <p className="eyebrow">Lectura personal</p>
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
                        <Link className="ghost-link compact-action" to={`/libros/${item.copy_id}`}>
                          Abrir ficha
                        </Link>
                      </div>
                    </div>

                    <dl className="reading-entry-meta">
                      <div>
                        <dt>Estado</dt>
                        <dd>{statusLabels[item.reading_status]}</dd>
                      </div>
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

                    <div className="reading-entry-footer">
                      <div className="reading-entry-badges">
                        <span className={`reading-pill ${item.reading_status}`}>
                          <span className="reading-pill-icon" aria-hidden="true">
                            {item.reading_status === "pending" ? "P" : item.reading_status === "reading" ? "L" : "T"}
                          </span>
                          {statusLabels[item.reading_status]}
                        </span>
                        {showLibraryBadge && library ? <span className="library-badge">{library.name}</span> : null}
                      </div>
                      <p className="reading-notes-preview">
                        {item.personal_notes ? item.personal_notes : "Sin notas personales todavia."}
                      </p>
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
                      <span className="status-chip">{statusLabels[editorState.readingStatus]}</span>
                    </div>

                    <div className="modal-grid">
                      <label className="field-group">
                        Estado de lectura
                        <select
                          value={editorState.readingStatus}
                          onChange={(event) =>
                            setEditorState((currentState) =>
                              currentState
                                ? { ...currentState, readingStatus: event.target.value as ReadingStatus }
                                : currentState,
                            )
                          }
                        >
                          <option value="pending">Pendiente</option>
                          <option value="reading">Leyendo</option>
                          <option value="finished">Leido</option>
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
                          onChange={(event) =>
                            setEditorState((currentState) =>
                              currentState
                                ? {
                                    ...currentState,
                                    startDate: event.target.value,
                                    readingStatus: deriveReadingStatusFromDates(
                                      currentState.readingStatus,
                                      event.target.value,
                                      currentState.endDate,
                                    ),
                                  }
                                : currentState,
                            )
                          }
                        />
                      </label>

                      <label className="field-group">
                        Fecha de fin
                        <input
                          type="date"
                          value={editorState.endDate}
                          onChange={(event) =>
                            setEditorState((currentState) =>
                              currentState
                                ? {
                                    ...currentState,
                                    endDate: event.target.value,
                                    readingStatus: deriveReadingStatusFromDates(
                                      currentState.readingStatus,
                                      currentState.startDate,
                                      event.target.value,
                                    ),
                                  }
                                : currentState,
                            )
                          }
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
                          setEditingCopyId(null);
                          setEditorState(null);
                        }}
                        disabled={updateReadingMutation.isPending}
                      >
                        Cancelar
                      </button>
                    </div>

                    {updateReadingMutation.isError ? (
                      <p className="form-error">
                        {updateReadingMutation.error instanceof Error
                          ? updateReadingMutation.error.message
                          : "No se pudieron guardar los cambios de lectura."}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
