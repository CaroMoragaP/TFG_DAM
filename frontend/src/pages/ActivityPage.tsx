import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { DashboardHero } from "../components/DashboardHero";
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
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRating(value: number | null) {
  return value === null ? "Sin media publica" : `${value.toFixed(1)}/5`;
}

function renderReviewSummary(card: LibraryReviewCard) {
  if (card.other_reviews.length === 0) {
    return <p>Todavia no hay opiniones de otros miembros para este ejemplar.</p>;
  }

  return card.other_reviews.map((review) => (
    <div key={review.id} className="community-list-item">
      <strong>
        {review.user_name} - {review.rating}/5
      </strong>
      <p>{review.body ?? "Solo ha dejado una valoracion con estrellas."}</p>
    </div>
  ));
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
  const activeLibrary =
    sharedLibraries.find((library) => library.id === selectedLibraryId) ?? null;

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
      <section className="content-stack private-page-shell">
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas disponibles para el muro.</p>
        </div>
      </section>
    );
  }

  if (!isLibrariesLoading && sharedLibraries.length === 0) {
    return (
      <section className="content-stack private-page-shell">
        <DashboardHero
          eyebrow="Comunidad"
          title="Comunidad"
          description="Todavia no tienes acceso a ninguna biblioteca compartida."
          icon="community"
        />
      </section>
    );
  }

  return (
    <section className="content-stack private-page-shell">
      <DashboardHero
        eyebrow="Comunidad"
        title="Comunidad"
        description={
          activeLibrary
            ? `Sigue el pulso de ${activeLibrary.name} y descubre tanto la actividad del club como las valoraciones publicadas por sus miembros.`
            : "Elige una biblioteca compartida para consultar su actividad y sus opiniones."
        }
        icon="community"
      />

      <div className="panel reading-toolbar">
        <label className="field-group">
          Biblioteca compartida
          <select
            value={activeLibrary ? String(activeLibrary.id) : ""}
            onChange={(event) => updateSearchParam("library", event.target.value)}
            disabled={isLibrariesLoading}
          >
            <option value="">Selecciona una biblioteca</option>
            {sharedLibraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name}
              </option>
            ))}
          </select>
        </label>

        <div className="reading-tab-strip" role="tablist" aria-label="Vistas del muro">
          <button
            className={tab === "activity" ? "stats-tab active" : "stats-tab"}
            type="button"
            onClick={() => updateSearchParam("tab", "activity")}
          >
            Actividad
          </button>
          <button
            className={tab === "reviews" ? "stats-tab active" : "stats-tab"}
            type="button"
            onClick={() => updateSearchParam("tab", "reviews")}
          >
            Opiniones
          </button>
        </div>

        {tab === "reviews" ? (
          <>
            <label className="field-group">
              Mostrar
              <select value={reviewFilter} onChange={(event) => updateSearchParam("filter", event.target.value)}>
                <option value="all">Todas</option>
                <option value="missing_mine">Sin mi publicacion</option>
                <option value="mine">Solo mis publicaciones</option>
              </select>
            </label>

            <label className="field-group">
              Ordenar por
              <select value={reviewSort} onChange={(event) => updateSearchParam("sort", event.target.value)}>
                <option value="recent">Actividad reciente</option>
                <option value="rating">Mejor valoradas</option>
                <option value="count">Mas resenadas</option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      {!activeLibrary ? (
        <div className="panel">
          <p>Selecciona una biblioteca compartida para ver su actividad y sus opiniones.</p>
        </div>
      ) : null}

      {activeLibrary && tab === "activity" ? (
        <>
          {activityQuery.isPending ? (
            <div className="panel">
              <p>Cargando actividad reciente...</p>
            </div>
          ) : null}

          {activityQuery.isError ? (
            <div className="panel">
              <p>No se pudo cargar el muro de actividad.</p>
            </div>
          ) : null}

          {activityQuery.data && activityQuery.data.items.length === 0 ? (
            <div className="panel empty-state">
              <h3>El muro aun esta vacio.</h3>
              <p>Cuando alguien lea, resene, preste o anada libros, aparecera aqui.</p>
            </div>
          ) : null}

          {activityQuery.data?.items.map((event) => (
            <article key={event.id} className="panel community-list-item">
              <p className="eyebrow">{formatTimestamp(event.created_at)}</p>
              <h3>{event.actor_name}</h3>
              <p>{formatEventLabel(event)}</p>
              {event.copy_id ? (
                <div className="inline-actions">
                  <Link className="ghost-link compact-action" to={`/libros/${event.copy_id}`}>
                    Abrir ficha
                  </Link>
                  <Link
                    className="ghost-link compact-action"
                    to={`/lectura?library=${activeLibrary.id}&copy=${event.copy_id}`}
                  >
                    Abrir seguimiento
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </>
      ) : null}

      {activeLibrary && tab === "reviews" ? (
        <>
          {reviewsQuery.isPending ? (
            <div className="panel">
              <p>Cargando opiniones del club...</p>
            </div>
          ) : null}

          {reviewsQuery.isError ? (
            <div className="panel">
              <p>No se pudieron cargar las opiniones publicas de esta biblioteca.</p>
            </div>
          ) : null}

          {reviewsQuery.data && reviewsQuery.data.items.length === 0 ? (
            <div className="panel empty-state">
              <h3>Todavia no hay reseÃ±as para este filtro.</h3>
              <p>Publica tu valoracion desde Lectura para arrancar la conversacion compartida.</p>
            </div>
          ) : null}

          {reviewsQuery.data?.items.map((card) => (
            <article key={card.copy_id} className="panel content-stack">
              <div className="community-card-header">
                <div>
                  <p className="eyebrow">Opiniones compartidas</p>
                  <h3>{card.title}</h3>
                  <p>{card.authors[0] ?? "Autor sin registrar"}</p>
                </div>
                <div className="community-stat-row">
                  <span className="status-chip active">{card.public_review_count} resenas</span>
                  <span className="status-chip">{formatRating(card.public_average_rating)}</span>
                </div>
              </div>

              <div className="community-review-split">
                <div className="content-stack">
                  <p className="eyebrow">Tu publicacion</p>
                  {card.my_review ? (
                    <div className="community-list-item own-review-card">
                      <strong>
                        {card.my_review.user_name} - {card.my_review.rating}/5
                      </strong>
                      <p>{card.my_review.body ?? "Solo has dejado una valoracion con estrellas."}</p>
                    </div>
                  ) : (
                    <p>Todavia no has publicado tu valoracion para este libro.</p>
                  )}
                </div>

                <div className="content-stack">
                  <p className="eyebrow">Comunidad</p>
                  {renderReviewSummary(card)}
                </div>
              </div>

              <div className="inline-actions">
                <Link className="ghost-link compact-action" to={`/libros/${card.copy_id}`}>
                  Abrir ficha
                </Link>
                <Link
                  className="ghost-link compact-action"
                  to={`/lectura?library=${activeLibrary.id}&copy=${card.copy_id}`}
                >
                  Publicar o editar
                </Link>
              </div>
            </article>
          ))}
        </>
      ) : null}
    </section>
  );
}
