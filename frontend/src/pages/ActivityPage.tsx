import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useLibraries } from "../libraries/useLibraries";
import {
  fetchLibraryActivity,
  fetchLibraryReviews,
  type LibraryActivityEvent,
  type LibraryReviewCard,
} from "../lib/api";

type WallTab = "activity" | "reviews";
type ReviewFilter = "all" | "missing_mine" | "mine";
type ReviewSort = "recent" | "rating" | "count";

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

function normalizeLibraryValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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
      return `empezo a leer ${bookTitle}`;
    case "reading_finished":
      return `termino ${bookTitle}`;
    case "review_published":
      return `publico una resena sobre ${bookTitle}`;
    case "review_updated":
      return `actualizo su resena de ${bookTitle}`;
    case "loan_started":
      return `presto ${bookTitle} a ${borrowerName}`;
    case "loan_returned":
      return `registro la devolucion de ${bookTitle}`;
    case "book_added":
      return `anadio ${bookTitle}`;
    case "books_imported":
      return `anadio ${importedCount === 1 ? "1 libro" : `${importedCount ?? 0} libros`}`;
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
    return `Hace ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  }

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatRating(value: number | null) {
  return value === null ? "Sin media publica" : `${value.toFixed(1)}/5`;
}

function formatReviewCount(count: number) {
  return `${count} ${count === 1 ? "resena" : "resenas"}`;
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
      return "Nueva opinion";
    case "review_updated":
      return "Opinion editada";
    case "loan_started":
      return "Prestamo";
    case "loan_returned":
      return "Devolucion";
    case "book_added":
      return "Nuevo libro";
    case "books_imported":
      return "Importacion";
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

function CommunityMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm7 1.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
        fill="currentColor"
      />
      <path
        d="M3.5 18.25A4.75 4.75 0 0 1 8.25 13.5h.5A4.75 4.75 0 0 1 13.5 18.25a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75Zm10.25.75a.75.75 0 0 1-.75-.75 4.7 4.7 0 0 0-1.11-3.02 4.12 4.12 0 0 1 2.36-.73h.5a4.75 4.75 0 0 1 4.75 4.75.75.75 0 0 1-.75.75h-5Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

function StarMark({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="m12 3.75 2.55 5.17 5.7.83-4.13 4.03.98 5.67L12 16.78 6.9 19.45l.98-5.67-4.13-4.03 5.7-.83L12 3.75Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookCover({
  title,
  coverUrl,
  className,
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
}) {
  return (
    <div className={className ? `book-cover-shell ${className}` : "book-cover-shell"}>
      {coverUrl ? (
        <img className="book-cover-image" src={coverUrl} alt={`Portada de ${title}`} loading="lazy" />
      ) : (
        <div className="book-cover-placeholder" aria-hidden="true">
          {title.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="community-stars" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? "community-star is-filled" : "community-star"}
          aria-hidden="true"
        >
          <StarMark filled={star <= rating} />
        </span>
      ))}
    </div>
  );
}

function CommunityHero({
  title,
  description,
  isLibrarySelected,
  memberCount,
  copyCount,
}: {
  title: string;
  description: string;
  isLibrarySelected: boolean;
  memberCount?: number;
  copyCount?: number;
}) {
  return (
    <div className="community-hero-shell">
      <div className="community-hero-copy">
        <span className="community-hero-kicker">
          <span className="community-hero-mark">
            <CommunityMark />
          </span>
          Comunidad
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="community-hero-pills">
          <span className="community-hero-pill community-hero-pill-soft">
            {isLibrarySelected ? "Club de lectura activo" : "Selecciona una biblioteca compartida"}
          </span>
          {typeof memberCount === "number" ? (
            <span className="community-hero-pill">{memberCount} miembros</span>
          ) : null}
          {typeof copyCount === "number" ? (
            <span className="community-hero-pill">{copyCount} ejemplares</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ActivityPage() {
  const { token } = useAuth();
  const { isLibrariesError, isLibrariesLoading, libraries } = useLibraries();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = normalizeWallTab(searchParams.get("tab"));
  const reviewFilter = normalizeReviewFilter(searchParams.get("filter"));
  const reviewSort = normalizeReviewSort(searchParams.get("sort"));
  const selectedLibraryId = normalizeLibraryValue(searchParams.get("library"));
  const sharedLibraries = libraries.filter(
    (library) => !library.is_archived && library.type === "shared",
  );
  const defaultLibrary = sharedLibraries[0] ?? null;
  const activeLibrary =
    sharedLibraries.find((library) => library.id === selectedLibraryId) ??
    (selectedLibraryId === null ? defaultLibrary : null);

  useEffect(() => {
    if (isLibrariesLoading || !defaultLibrary || searchParams.has("library")) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("library", String(defaultLibrary.id));
    setSearchParams(nextSearchParams, { replace: true });
  }, [defaultLibrary, isLibrariesLoading, searchParams, setSearchParams]);

  const activityQuery = useQuery({
    queryKey: ["library-activity", activeLibrary?.id ?? null],
    queryFn: () =>
      fetchLibraryActivity(token ?? "", activeLibrary!.id, { limit: 50, offset: 0 }),
    enabled: Boolean(token && activeLibrary && tab === "activity"),
  });

  const reviewsQuery = useQuery({
    queryKey: ["library-reviews", activeLibrary?.id ?? null, reviewFilter, reviewSort],
    queryFn: () =>
      fetchLibraryReviews(token ?? "", activeLibrary!.id, {
        filter: reviewFilter,
        sort: reviewSort,
        limit: 50,
        offset: 0,
      }),
    enabled: Boolean(token && activeLibrary && tab === "reviews"),
  });

  function updateSearchParam(
    key: "tab" | "filter" | "sort" | "library",
    value: string,
  ) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (key === "library" && !value) {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }

  if (isLibrariesError) {
    return (
      <section className="content-stack private-page-shell community-page">
        <CommunityHero
          title="Comunidad"
          description="No se pudieron cargar las bibliotecas disponibles para el muro."
          isLibrarySelected={false}
        />
        <div className="panel community-message-panel">
          <p>No se pudieron cargar las bibliotecas disponibles para el muro.</p>
        </div>
      </section>
    );
  }

  if (!isLibrariesLoading && sharedLibraries.length === 0) {
    return (
      <section className="content-stack private-page-shell community-page">
        <CommunityHero
          title="Comunidad"
          description="Aun no formas parte de una biblioteca compartida dentro del muro."
          isLibrarySelected={false}
        />
        <div className="panel community-empty-panel">
          <h3>Comunidad</h3>
          <p>Todavia no tienes acceso a ninguna biblioteca compartida.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="content-stack private-page-shell community-page">
      <CommunityHero
        title={activeLibrary ? activeLibrary.name : "Comunidad"}
        description={
          activeLibrary
            ? `Sigue el pulso de ${activeLibrary.name} y descubre tanto la actividad del club como las valoraciones publicadas por sus miembros.`
            : "Elige una biblioteca compartida para consultar su actividad y sus opiniones."
        }
        isLibrarySelected={Boolean(activeLibrary)}
        memberCount={activeLibrary?.member_count}
        copyCount={activeLibrary?.copy_count}
      />

      <div className="panel community-toolbar-panel">
        <div className="community-toolbar-main">
          <label className="field-group community-toolbar-field">
            Biblioteca compartida
            <select
              value={activeLibrary ? String(activeLibrary.id) : ""}
              onChange={(event) => updateSearchParam("library", event.target.value)}
              disabled={isLibrariesLoading}
            >
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
              <span className="community-tab-mark">AC</span>
              Actividad
            </button>
            <button
              className={tab === "reviews" ? "community-tab active" : "community-tab"}
              type="button"
              onClick={() => updateSearchParam("tab", "reviews")}
              aria-selected={tab === "reviews"}
            >
              <span className="community-tab-mark">OP</span>
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
                <option value="missing_mine">Sin mi publicacion</option>
                <option value="mine">Solo mis publicaciones</option>
              </select>
            </label>

            <label className="field-group community-toolbar-field">
              Ordenar por
              <select value={reviewSort} onChange={(event) => updateSearchParam("sort", event.target.value)}>
                <option value="recent">Actividad reciente</option>
                <option value="rating">Mejor valoradas</option>
                <option value="count">Mas resenadas</option>
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

          {activityQuery.data && activityQuery.data.items.length === 0 ? (
            <div className="panel community-empty-panel">
              <h3>El muro aun esta vacio.</h3>
              <p>Cuando alguien lea, resene, preste o anada libros, aparecera aqui.</p>
            </div>
          ) : null}

          {activityQuery.data ? (
            <div className="community-feed">
              {activityQuery.data.items.map((event) => {
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
                        <span className="community-event-badge-mark">{getEventBadgeMark(event.event_type)}</span>
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
                        {rating !== null ? <StarRating rating={rating} /> : null}
                      </div>
                    </div>

                    {event.copy_id ? (
                      <div className="community-card-actions">
                        <Link className="ghost-link compact-action" to={`/libros/${event.copy_id}`}>
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
              <p>No se pudieron cargar las opiniones publicas de esta biblioteca.</p>
            </div>
          ) : null}

          {reviewsQuery.data && reviewsQuery.data.items.length === 0 ? (
            <div className="panel community-empty-panel">
              <h3>Todavia no hay resenas para este filtro.</h3>
              <p>Publica tu valoracion desde Lectura para arrancar la conversacion compartida.</p>
            </div>
          ) : null}

          {reviewsQuery.data ? (
            <div className="community-review-list">
              {reviewsQuery.data.items.map((card: LibraryReviewCard) => (
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
                      <p className="eyebrow">Tu publicacion</p>
                      {card.my_review ? (
                        <div className="community-review-entry own-review-card">
                          <div className="community-review-entry-head">
                            <div>
                              <strong>{card.my_review.user_name}</strong>
                              <p>Tu mirada sobre este ejemplar</p>
                            </div>
                            <StarRating rating={card.my_review.rating} />
                          </div>
                          <p>{card.my_review.body ?? "Solo has dejado una valoracion con estrellas."}</p>
                        </div>
                      ) : (
                        <div className="community-review-entry community-review-entry-empty">
                          <strong>Todavia no has publicado tu valoracion para este libro.</strong>
                          <p>Comparte tu lectura desde la ficha de seguimiento para sumarte a la conversacion.</p>
                        </div>
                      )}
                    </section>

                    <section className="community-review-column">
                      <p className="eyebrow">Comunidad</p>
                      {card.other_reviews.length === 0 ? (
                        <div className="community-review-entry community-review-entry-empty">
                          <strong>Sin opiniones de otros miembros</strong>
                          <p>Todavia no hay opiniones de otros miembros para este ejemplar.</p>
                        </div>
                      ) : (
                        <div className="community-review-stack">
                          {card.other_reviews.map((review) => (
                            <div key={review.id} className="community-review-entry">
                              <div className="community-review-entry-head">
                                <div>
                                  <strong>{review.user_name}</strong>
                                  <p>Lectora compartida</p>
                                </div>
                                <StarRating rating={review.rating} />
                              </div>
                              <p>{review.body ?? "Solo ha dejado una valoracion con estrellas."}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="community-card-actions">
                    <Link className="ghost-link compact-action" to={`/libros/${card.copy_id}`}>
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
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
