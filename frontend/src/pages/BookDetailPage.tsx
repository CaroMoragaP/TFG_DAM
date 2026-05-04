import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookMetadataModal, type BookMetadataValues } from "../components/BookMetadataModal";
import { CopyEditModal, type CopyEditValues } from "../components/CopyEditModal";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  deleteCopyRequest,
  fetchCopyById,
  fetchCopyCommunity,
  fetchThemes,
  fetchUserCopyData,
  updateBookMetadataRequest,
  updateCopyRequest,
  type BookMetadata,
  type CopyCommunity,
  type CopyDetail,
  type ReadingStatus,
} from "../lib/api";

const statusLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  finished: "Leido",
};

const authorSexLabels = {
  male: "Hombre",
  female: "Mujer",
  non_binary: "No binario",
  unknown: "Desconocido",
} as const;

function toBookMetadata(detail: CopyDetail): BookMetadata {
  return {
    id: detail.book_id,
    title: detail.title,
    isbn: detail.isbn,
    publication_year: detail.publication_year,
    description: detail.description,
    cover_url: detail.cover_url,
    publisher: detail.publisher,
    collection: detail.collection,
    author_country: detail.author_country,
    author_sex: detail.author_sex,
    primary_author: detail.primary_author,
    authors: detail.authors,
    genre: detail.genre,
    themes: detail.themes,
  };
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-ES");
}

function formatCommunityRating(value: number | null) {
  return value === null ? "Sin media publica" : `${value.toFixed(1)}/5`;
}

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { libraries } = useActiveLibrary();

  const copyId = Number(id);
  const isValidCopyId = Number.isInteger(copyId) && copyId > 0;

  const copyQuery = useQuery({
    queryKey: ["copy", copyId],
    queryFn: () => fetchCopyById(token ?? "", copyId),
    enabled: Boolean(token && isValidCopyId),
  });

  const userDataQuery = useQuery({
    queryKey: ["copy-user-data", copyId],
    queryFn: () => fetchUserCopyData(token ?? "", copyId),
    enabled: Boolean(token && isValidCopyId),
  });

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: () => fetchThemes(token ?? ""),
    enabled: Boolean(token),
  });

  const sharedLibraryForCopy =
    copyQuery.data ? libraries.find((item) => item.id === copyQuery.data.library_id) ?? null : null;
  const isSharedLibraryView = sharedLibraryForCopy?.type === "shared";

  const communityQuery = useQuery({
    queryKey: ["copy-community", copyId],
    queryFn: () => fetchCopyCommunity(token ?? "", copyId),
    enabled: Boolean(token && isValidCopyId && copyQuery.data && isSharedLibraryView),
  });

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  const updateCopyMutation = useMutation({
    mutationFn: (payload: CopyEditValues) =>
      updateCopyRequest(token ?? "", copyId, {
        format: payload.format,
        status: payload.status,
        physical_location: payload.physicalLocation.trim() || null,
        digital_location: payload.digitalLocation.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["copy", copyId] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]);
      setIsCopyModalOpen(false);
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: (payload: BookMetadataValues) =>
      updateBookMetadataRequest(token ?? "", copyQuery.data!.book_id, {
        title: payload.title.trim(),
        primary_author_first_name: payload.authorFirstName.trim() || null,
        primary_author_last_name: payload.authorLastName.trim() || null,
        primary_author_display_name:
          [payload.authorFirstName.trim(), payload.authorLastName.trim()].filter(Boolean).join(" ") || null,
        authors:
          [payload.authorFirstName.trim(), payload.authorLastName.trim()].filter(Boolean).length > 0
            ? [[payload.authorFirstName.trim(), payload.authorLastName.trim()].filter(Boolean).join(" ")]
            : [],
        author_sex: payload.authorSex || null,
        author_country_name: payload.authorCountry.trim() || null,
        publication_year: payload.publicationYear.trim() ? Number(payload.publicationYear) : null,
        isbn: payload.isbn.trim() || null,
        genre: payload.genre.trim() || null,
        themes: payload.themes,
        collection_name: payload.collection.trim() || null,
        cover_url: payload.coverUrl.trim() || null,
        description: payload.description.trim() || null,
        publisher_name: payload.publisherName.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["copy", copyId] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["themes"] }),
      ]);
      setIsBookModalOpen(false);
    },
  });

  const deleteCopyMutation = useMutation({
    mutationFn: () => deleteCopyRequest(token ?? "", copyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      navigate("/catalogo", { replace: true });
    },
  });

  if (!isValidCopyId) {
    return (
      <section className="content-stack">
        <div className="panel">
          <p>El identificador del ejemplar no es valido.</p>
        </div>
      </section>
    );
  }

  const isLoading = copyQuery.isPending || userDataQuery.isPending;
  const isError = copyQuery.isError || userDataQuery.isError;
  const detail = copyQuery.data;
  const userData = userDataQuery.data;
  const library = detail ? libraries.find((item) => item.id === detail.library_id) ?? null : null;
  const isSharedLibrary = library?.type === "shared";
  const canEditCopy = Boolean(library && !library.is_archived && library.role !== "viewer");
  const canEditBook = Boolean(library && !library.is_archived && library.role === "owner");
  const author = detail?.primary_author?.display_name ?? detail?.authors[0] ?? "Autor sin registrar";
  const genre = detail?.genre ?? "-";
  const themes = detail?.themes ?? [];
  const collection = detail?.collection ?? "-";
  const authorCountry = detail?.author_country ?? "-";
  const authorSex = detail?.author_sex ? authorSexLabels[detail.author_sex] : "-";
  const coverLetter = (detail?.title.trim().slice(0, 1) || "?").toUpperCase();
  const community = (communityQuery.data ??
    (detail
      ? {
          copy_id: detail.id,
          active_loan: detail.active_loan,
          shared_readers: detail.shared_readers_preview,
          shared_readers_count: detail.shared_readers_count,
          public_review_count: detail.public_review_count,
          public_average_rating: detail.public_average_rating,
          latest_reviews: [],
        }
      : null)) as CopyCommunity | null;

  async function handleDelete() {
    if (!window.confirm("Se eliminara este ejemplar del catalogo. Quieres continuar?")) {
      return;
    }
    await deleteCopyMutation.mutateAsync();
  }

  return (
    <section className="content-stack">
      <button className="ghost-link detail-back-button" type="button" onClick={() => navigate(-1)}>
        Volver al catalogo
      </button>

      {isLoading ? (
        <div className="panel">
          <p>Cargando detalle del libro...</p>
        </div>
      ) : null}

      {isError ? (
        <div className="panel">
          <p>No se pudo cargar el detalle del libro.</p>
        </div>
      ) : null}

      {detail && userData ? (
        <div className="detail-layout">
          <article className="panel detail-main-card">
            <div className="detail-hero">
              <div className="detail-cover-shell">
                {detail.cover_url ? (
                  <img className="book-cover-image" src={detail.cover_url} alt={`Portada de ${detail.title}`} />
                ) : (
                  <div className="book-cover-placeholder" aria-hidden="true">
                    <span>{coverLetter}</span>
                  </div>
                )}
              </div>

              <div className="detail-copy">
                <p className="eyebrow">Ficha del ejemplar</p>
                <h2>{detail.title}</h2>
                <p className="detail-author">{author}</p>
                {detail.description ? <p className="detail-description">{detail.description}</p> : null}

                <dl className="detail-meta-grid">
                  <div>
                    <dt>Genero literario</dt>
                    <dd>{genre}</dd>
                  </div>
                  <div>
                    <dt>Temas</dt>
                    <dd>{themes.length > 0 ? themes.join(", ") : "-"}</dd>
                  </div>
                  <div>
                    <dt>Coleccion</dt>
                    <dd>{collection}</dd>
                  </div>
                  <div>
                    <dt>Pais autor</dt>
                    <dd>{authorCountry}</dd>
                  </div>
                  <div>
                    <dt>Sexo autor</dt>
                    <dd>{authorSex}</dd>
                  </div>
                  <div>
                    <dt>Ano</dt>
                    <dd>{detail.publication_year ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>ISBN</dt>
                    <dd>{detail.isbn ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Formato</dt>
                    <dd>{detail.format}</dd>
                  </div>
                </dl>

                <div className="detail-actions">
                  <Link className="ghost-link" to={`/lectura?library=${detail.library_id}&copy=${detail.id}`}>
                    Abrir seguimiento
                  </Link>
                  {isSharedLibrary ? (
                    <Link className="ghost-link" to={`/muro?tab=reviews&library=${detail.library_id}`}>
                      Abrir muro
                    </Link>
                  ) : null}
                  {canEditBook ? (
                    <button
                      className="ghost-link"
                      type="button"
                      onClick={() => setIsBookModalOpen(true)}
                      disabled={updateBookMutation.isPending}
                    >
                      Editar ficha
                    </button>
                  ) : null}
                  {canEditCopy ? (
                    <button
                      className="ghost-link"
                      type="button"
                      onClick={() => setIsCopyModalOpen(true)}
                      disabled={updateCopyMutation.isPending}
                    >
                      Editar ejemplar
                    </button>
                  ) : null}
                  {canEditCopy ? (
                    <button
                      className="ghost-link danger-action"
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteCopyMutation.isPending}
                    >
                      {deleteCopyMutation.isPending ? "Eliminando..." : "Eliminar ejemplar"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>

          <aside className="content-stack">
            <div className="panel detail-side-card content-stack">
              <div className="notes-header">
                <div>
                  <p className="eyebrow">Mi lectura</p>
                  <p className="detail-inline-copy">
                    El trabajo diario vive ahora en <Link to={`/lectura?library=${detail.library_id}&copy=${detail.id}`}>Lectura</Link>.
                  </p>
                </div>
              </div>

              <dl className="reading-entry-meta">
                <div>
                  <dt>Estado</dt>
                  <dd>{statusLabels[userData.reading_status]}</dd>
                </div>
                <div>
                  <dt>Valoracion</dt>
                  <dd>{userData.rating ? `${userData.rating}/5` : "-"}</dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{formatDateLabel(userData.start_date)}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{formatDateLabel(userData.end_date)}</dd>
                </div>
              </dl>

              <div className="content-stack">
                <strong>Notas personales</strong>
                <p className="reading-notes-preview">
                  {userData.personal_notes ? userData.personal_notes : "Sin notas personales todavia."}
                </p>
              </div>
            </div>

            {isSharedLibrary ? (
              <div className="panel detail-side-card content-stack">
                <p className="eyebrow">Comunidad</p>
                <div className="community-stat-row">
                  <span className="status-chip active">{community?.public_review_count ?? 0} resenas</span>
                  <span className="status-chip">{formatCommunityRating(community?.public_average_rating ?? null)}</span>
                </div>

                {community?.active_loan ? (
                  <div className="community-list-item">
                    <strong>Prestamo activo</strong>
                    <p>
                      Prestado a {community.active_loan.borrower_name}
                      {community.active_loan.due_date ? ` hasta ${formatDateLabel(community.active_loan.due_date)}` : ""}
                    </p>
                  </div>
                ) : (
                  <p>No hay ningun prestamo activo para este ejemplar.</p>
                )}

                <div className="content-stack">
                  <strong>Lectores actuales</strong>
                  {community?.shared_readers_count ? (
                    community.shared_readers.map((reader) => <p key={reader.user_id}>{reader.name}</p>)
                  ) : (
                    <p>Nadie lo esta leyendo ahora mismo.</p>
                  )}
                </div>

                <div className="content-stack">
                  <strong>Ultimas resenas</strong>
                  {community?.latest_reviews.length ? (
                    community.latest_reviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="community-list-item">
                        <strong>
                          {review.user_name} · {review.rating}/5
                        </strong>
                        <p>{review.body ?? "Solo ha dejado una valoracion con estrellas."}</p>
                      </div>
                    ))
                  ) : (
                    <p>Todavia no hay resenas publicas.</p>
                  )}
                </div>

                <div className="inline-actions">
                  <Link className="ghost-link compact-action" to={`/muro?tab=reviews&library=${detail.library_id}`}>
                    Ver opiniones
                  </Link>
                  <Link className="ghost-link compact-action" to={`/muro?tab=activity&library=${detail.library_id}`}>
                    Ver actividad
                  </Link>
                </div>
              </div>
            ) : null}

            {library?.is_archived ? (
              <div className="panel subtle-panel">
                <p className="eyebrow">Biblioteca archivada</p>
                <p>Esta copia pertenece a una biblioteca archivada y no admite cambios de catalogo.</p>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {detail ? (
        <>
          <CopyEditModal
            isOpen={isCopyModalOpen}
            copy={detail}
            isSaving={updateCopyMutation.isPending}
            onClose={() => setIsCopyModalOpen(false)}
            onSubmit={async (payload) => {
              await updateCopyMutation.mutateAsync(payload);
            }}
          />
          <BookMetadataModal
            isOpen={isBookModalOpen}
            book={toBookMetadata(detail)}
            themeOptions={themesQuery.data ?? []}
            isSaving={updateBookMutation.isPending}
            onClose={() => setIsBookModalOpen(false)}
            onSubmit={async (payload) => {
              await updateBookMutation.mutateAsync(payload);
            }}
          />
        </>
      ) : null}
    </section>
  );
}
