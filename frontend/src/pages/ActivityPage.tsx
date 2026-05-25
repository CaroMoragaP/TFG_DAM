import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookCover } from "../components/BookCover";
import { CommunityHero } from "../components/CommunityHero";
import { CommunityTagMark } from "../components/CommunityTagMark";
import { StarRating } from "../components/StarRating";
import { useLibraries } from "../libraries/useLibraries";
import {
  fetchLibraryActivity,
  fetchLibraryReviews,
  type LibraryActivityEvent,
  type LibraryReviewCard,
} from "../lib/api";
import { parsePositiveInt } from "../lib/urlParams";

type WallTab = "activity" | "reviews";
type ReviewFilter = "all" | "missing_mine" | "mine";
type ReviewSort = "recent" | "rating" | "count";
const PAGE_SIZE = 50;

function normalizeWallTab(value: string | null): WallTab {
  return value === "reviews" ? "reviews" : "activity";
}

function normalizeReviewFilter(value: string | null): ReviewFilter {
  if (value === "missing_mine" || value === "mine") {
    return value;
  }
  return "all";
}

function normalizeReviewSort(value: string | null): ReviewSort {
  if (value === "rating" || value === "count") {
    return value;
  }
  return "recent";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getPayloadString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function getPayloadNumber(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatEventLabel(event: LibraryActivityEvent) {
  const bookTitle =
    typeof event.payload_json.book_title === "string" ? event.payload_json.book_title : "este libro";
  const borrowerName =
    typeof event.payload_json.borrower_name === "string" ? event.payload_json.borrower_name : "alguien";
  const importedCount =
    typeof event.payload_json.imported_count === "number" ? event.payload_json.imported_count : null;

  switch (event.event_type) {
    case "reading_started":
      return `empezó a leer ${bookTitle}`;
    case "reading_finished":
      return `terminó ${bookTitle}`;
    case "review_published":
      return `publicó una reseña sobre ${bookTitle}`;
    case "review_updated":
      return `actualizó su reseña de ${bookTitle}`;
    case "loan_started":
      return `prestó ${bookTitle} a ${borrowerName}`;
    case "loan_returned":
      return `registró la devolución de ${bookTitle}`;
    case "book_added":
      return `añadió ${bookTitle}`;
    case "books_imported":
      return `añadió ${importedCount === 1 ? "1 libro" : `${importedCount ?? 0} libros`}`;
    default:
      return `hizo una actividad en ${bookTitle}`;
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return "Hace unos minutos";
  }

  if (diffHours < 24) {
    return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  }

  if (diffDays < 7) {
    return `Hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  }

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatRating(value: number | null) {
  return value === null ? "Sin media pública" : `${value.toFixed(1)}/5`;
}

function formatReviewCount(count: number) {
  return `${count} ${count === 1 ? "reseña" : "reseñas"}`;
}

function getEventTone(eventType: LibraryActivityEvent["event_type"]) {
  switch (eventType) {
    case "reading_started":
    case "reading_finished":
      return "reading";
    case "review_published":
    case "review_updated":
      return "review";
    case "loan_started":
    case "loan_returned":
      return "loan";
    case "book_added":
    case "books_imported":
      return "catalog";
    default:
      return "neutral";
  }
}

function getEventBadgeLabel(eventType: LibraryActivityEvent["event_type"]) {
  switch (eventType) {
    case "reading_started":
      return "Lectura en curso";
    case "reading_finished":
      return "Lectura cerrada";
    case "review_published":
      return "Nueva opinión";
    case "review_updated":
      return "Opinion editada";
    case "loan_started":
      return "Préstamo";
    case "loan_returned":
      return "Devolución";
    case "book_added":
      return "Nuevo libro";
    case "books_imported":
      return "Importación";
    default:
      return "Actividad";
  }
}

function getEventBadgeMark(eventType: LibraryActivityEvent["event_type"]) {
  switch (eventType) {
    case "reading_started":
      return "LE";
    case "reading_finished":
      return "OK";
    case "review_published":
      return "OP";
    case "review_updated":
      return "ED";
    case "loan_started":
      return "PR";
    case "loan_returned":
      return "DV";
    case "book_added":
      return "LB";
    case "books_imported":
      return "IM";
    default:
      return "AC";
  }
}

export function ActivityPage() {
  const { token } = useAuth();
  const { isLibrariesError, isLibrariesLoading, libraries } = useLibraries();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = normalizeWallTab(searchParams.get("tab"));
  const reviewFilter = normalizeReviewFilter(searchParams.get("filter"));
  const reviewSort = normalizeReviewSort(searchParams.get("sort"));
  const selectedLibraryId = parsePositiveInt(searchParams.get("library"));
  const sharedLibraries = libraries.filter(
    (library) => !library.is_archived && library.type === "shared",
  );
  const defaultLibrary = sharedLibraries[0] ?? null;
  const activeLibrary =
    sharedLibraries.find((library) => library.id === selectedLibraryId) ??
    (selectedLibraryId === undefined ? defaultLibrary : null);

  useEffect(() => {
    if (isLibrariesLoading || !defaultLibrary) {
      return;
    }

    const hasValidSelectedLibrary =
      selectedLibraryId !== undefined &&
      sharedLibraries.some((library) => library.id === selectedLibraryId);
    if (hasValidSelectedLibrary) {
      return;
    }

    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set("library", String(defaultLibrary.id));
      return nextSearchParams;
    }, { replace: true });
  }, [defaultLibrary, isLibrariesLoading, selectedLibraryId, setSearchParams, sharedLibraries]);

  const activityQuery = useInfiniteQuery({
    queryKey: ["library-activity", activeLibrary?.id ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchLibraryActivity(token ?? "", activeLibrary!.id, {
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: Boolean(token && activeLibrary && tab === "activity"),
  });

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["library-reviews", activeLibrary?.id ?? null, reviewFilter, reviewSort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchLibraryReviews(token ?? "", activeLibrary!.id, {
        filter: reviewFilter,
        sort: reviewSort,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: Boolean(token && activeLibrary && tab === "reviews"),
  });

  const activityItems = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const reviewsItems = reviewsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const updateSearchParam = useCallback(
    (
      key: "tab" | "filter" | "sort" | "library",
      value: string,
    ) => {
      setSearchParams((currentSearchParams) => {
        const nextSearchParams = new URLSearchParams(currentSearchParams);
        if (key === "library" && !value) {
          nextSearchParams.delete(key);
        } else {
          nextSearchParams.set(key, value);
        }
        return nextSearchParams;
      }, { replace: true });
    },
    [setSearchParams],
  );

  if (isLibrariesError) {
    return (
      <section className="content-stack private-page-shell community-page">
        <CommunityHero />
        <div className="panel community-message-panel">
          <p>No se pudieron cargar las bibliotecas disponibles para el muro.</p>
        </div>
      </section>
    );
  }

  if (!isLibrariesLoading && sharedLibraries.length === 0) {
    return (
      <section className="content-stack private-page-shell community-page">
        <CommunityHero />
        <div className="panel community-empty-panel">
          <h3>Comunidad</h3>
          <p>Todavía no tienes acceso a ninguna biblioteca compartida.</p>
          <div className="inline-actions">
            <Link className="button-primary compact-action" to="/bibliotecas">
              Ir a Mis bibliotecas
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-stack private-page-shell community-page">
      <CommunityHero />

      <div className="panel community-toolbar-panel">
        <div className="community-toolbar-main">
          <label className="field-group community-toolbar-field">
            Biblioteca compartida
            <select
              value={activeLibrary ? String(activeLibrary.id) : ""}
              onChange={(event) => updateSearchParam("library", event.target.value)}
              disabled={isLibrariesLoading}
            >
              {isLibrariesLoading ? <option value="">Cargando bibliotecas...</option> : null}
              {sharedLibraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
          </label>

          <div className="community-tab-strip" role="tablist" aria-label="Vistas del muro">
            <button
              className={tab === "activity" ? "community-tab active" : "community-tab"}
              type="button"
              onClick={() => updateSearchParam("tab", "activity")}
              aria-selected={tab === "activity"}
            >
              <CommunityTagMark className="community-tab-mark" label="AC" />
              Actividad
            </button>
            <button
              className={tab === "reviews" ? "community-tab active" : "community-tab"}
              type="button"
              onClick={() => updateSearchParam("tab", "reviews")}
              aria-selected={tab === "reviews"}
            >
              <CommunityTagMark className="community-tab-mark" label="OP" />
              Opiniones
            </button>
          </div>
        </div>

        {tab === "reviews" ? (
          <div className="community-filter-row">
            <label className="field-group community-toolbar-field">
              Mostrar
              <select value={reviewFilter} onChange={(event) => updateSearchParam("filter", event.target.value)}>
                <option value="all">Todas</option>
                <option value="missing_mine">Sin mi publicación</option>
                <option value="mine">Solo mis publicaciones</option>
              </select>
            </label>

            <label className="field-group community-toolbar-field">
              Ordenar por
              <select value={reviewSort} onChange={(event) => updateSearchParam("sort", event.target.value)}>
                <option value="recent">Actividad reciente</option>
                <option value="rating">Mejor valoradas</option>
                <option value="count">Más reseñadas</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {!activeLibrary ? (
        <div className="panel community-empty-panel">
          <h3>Selecciona una biblioteca compartida</h3>
          <p>Selecciona una biblioteca compartida para ver su actividad y sus opiniones.</p>
        </div>
      ) : null}

      {activeLibrary && tab === "activity" ? (
        <>
          {activityQuery.isPending ? (
            <div className="panel community-message-panel">
              <p>Cargando actividad reciente...</p>
            </div>
          ) : null}

          {activityQuery.isError ? (
            <div className="panel community-message-panel">
              <p>No se pudo cargar el muro de actividad.</p>
            </div>
          ) : null}

          {activityQuery.data && activityItems.length === 0 ? (
            <div className="panel community-empty-panel">
              <h3>El muro aún está vacío.</h3>
              <p>Cuando alguien lea, reseñe, preste o añada libros, aparecerá aquí.</p>
            </div>
          ) : null}

          {activityQuery.data ? (
            <div className="community-feed">
              {activityItems.map((event) => {
                const tone = getEventTone(event.event_type);
                const title =
                  getPayloadString(event.payload_json, "book_title") ?? "Movimiento del club";
                const author = getPayloadString(event.payload_json, "book_author", "author_name");
                const coverUrl = getPayloadString(event.payload_json, "book_cover", "cover_url");
                const rating = getPayloadNumber(event.payload_json, "rating");

                return (
                  <article
                    key={event.id}
                    className={`panel community-event-card community-event-card-${tone}`}
                  >
                    <div className="community-event-header">
                      <div className="community-event-identity">
                        <span className="community-avatar">{getInitials(event.actor_name)}</span>
                        <div className="community-event-person">
                          <p className="community-event-time">{formatTimestamp(event.created_at)}</p>
                          <h3>{event.actor_name}</h3>
                        </div>
                      </div>

                      <span className={`community-event-badge tone-${tone}`}>
                        <CommunityTagMark
                          className="community-event-badge-mark"
                          label={getEventBadgeMark(event.event_type)}
                        />
                        {getEventBadgeLabel(event.event_type)}
                      </span>
                    </div>

                    <div className={coverUrl ? "community-event-body has-cover" : "community-event-body"}>
                      {coverUrl ? (
                        <BookCover title={title} coverUrl={coverUrl} className="community-event-cover" />
                      ) : null}

                      <div className="community-event-copy">
                        <p className="community-event-summary">{formatEventLabel(event)}</p>
                        <strong>{title}</strong>
                        {author ? <p>{author}</p> : null}
                        {rating !== null ? <StarRating rating={rating} className="community-stars" /> : null}
                      </div>
                    </div>

                    {event.copy_id ? (
                      <div className="community-card-actions">
                        <Link className="ghost-link compact-action" to={`/ejemplar/${event.copy_id}`}>
                          Abrir ficha
                        </Link>
                        <Link
                          className="button-primary compact-action"
                          to={`/lectura?library=${activeLibrary.id}&copy=${event.copy_id}`}
                        >
                          Abrir seguimiento
                        </Link>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {activityQuery.hasNextPage ? (
                <div className="community-card-actions">
                  <button
                    className="ghost-link compact-action"
                    type="button"
                    onClick={() => void activityQuery.fetchNextPage()}
                    disabled={activityQuery.isFetchingNextPage}
                  >
                    {activityQuery.isFetchingNextPage ? "Cargando..." : "Ver más actividad"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {activeLibrary && tab === "reviews" ? (
        <>
          {reviewsQuery.isPending ? (
            <div className="panel community-message-panel">
              <p>Cargando opiniones del club...</p>
            </div>
          ) : null}

          {reviewsQuery.isError ? (
            <div className="panel community-message-panel">
              <p>No se pudieron cargar las opiniones públicas de esta biblioteca.</p>
            </div>
          ) : null}

          {reviewsQuery.data && reviewsItems.length === 0 ? (
            <div className="panel community-empty-panel">
              <h3>Todavía no hay reseñas para este filtro.</h3>
              <p>Publica tu valoración desde Lectura para arrancar la conversación compartida.</p>
            </div>
          ) : null}

          {reviewsQuery.data ? (
            <div className="community-review-list">
              {reviewsItems.map((card: LibraryReviewCard) => (
                <article key={card.copy_id} className="panel community-review-card">
                  <div className="community-review-header">
                    <div className="community-review-heading">
                      <BookCover
                        title={card.title}
                        coverUrl={card.cover_url}
                        className="community-review-cover"
                      />
                      <div className="community-review-heading-copy">
                        <p className="eyebrow">Opiniones compartidas</p>
                        <h3>{card.title}</h3>
                        <p>{card.authors[0] ?? "Autor sin registrar"}</p>
                      </div>
                    </div>

                    <div className="community-stat-row">
                      <span className="status-chip active">{formatReviewCount(card.public_review_count)}</span>
                      <span className="status-chip">{formatRating(card.public_average_rating)}</span>
                    </div>
                  </div>

                  <div className="community-review-split community-review-columns">
                    <section className="community-review-column community-review-column-own">
                      <p className="eyebrow">Tu publicación</p>
                      {card.my_review ? (
                        <div className="community-review-entry own-review-card">
                          <div className="community-review-entry-head">
                            <div>
                              <strong>{card.my_review.user_name}</strong>
                              <p>Tu mirada sobre este ejemplar</p>
                            </div>
                            <StarRating rating={card.my_review.rating} className="community-stars" />
                          </div>
                          <p>{card.my_review.body ?? "Solo has dejado una valoración con estrellas."}</p>
                        </div>
                      ) : (
                        <div className="community-review-entry community-review-entry-empty">
                          <strong>Todavía no has publicado tu valoración para este libro.</strong>
                          <p>Comparte tu lectura desde la ficha de seguimiento para sumarte a la conversación.</p>
                        </div>
                      )}
                    </section>

                    <section className="community-review-column">
                      <p className="eyebrow">Comunidad</p>
                      {card.other_reviews.length === 0 ? (
                        <div className="community-review-entry community-review-entry-empty">
                          <strong>Sin opiniones de otros miembros</strong>
                          <p>Todavía no hay opiniones de otros miembros para este ejemplar.</p>
                        </div>
                      ) : (
                        <div className="community-review-stack">
                          {card.other_reviews.map((review) => (
                            <div key={review.id} className="community-review-entry">
                              <div className="community-review-entry-head">
                                <div>
                                  <strong>{review.user_name}</strong>
                                  <p>Miembro del club</p>
                                </div>
                                <StarRating rating={review.rating} className="community-stars" />
                              </div>
                              <p>{review.body ?? "Solo ha dejado una valoración con estrellas."}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="community-card-actions">
                    <Link className="ghost-link compact-action" to={`/ejemplar/${card.copy_id}`}>
                      Abrir ficha
                    </Link>
                    <Link
                      className="button-primary compact-action"
                      to={`/lectura?library=${activeLibrary.id}&copy=${card.copy_id}`}
                    >
                      Publicar o editar
                    </Link>
                  </div>
                </article>
              ))}

              {reviewsQuery.hasNextPage ? (
                <div className="community-card-actions">
                  <button
                    className="ghost-link compact-action"
                    type="button"
                    onClick={() => void reviewsQuery.fetchNextPage()}
                    disabled={reviewsQuery.isFetchingNextPage}
                  >
                    {reviewsQuery.isFetchingNextPage ? "Cargando..." : "Ver más opiniones"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
