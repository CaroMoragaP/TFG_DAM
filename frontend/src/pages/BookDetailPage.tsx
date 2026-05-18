import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookCover } from "../components/BookCover";
import { type BookMetadataValues } from "../components/BookMetadataModal";
import { BookDetailEditModal, type BookDetailEditValues } from "../components/BookDetailEditModal";
import { type CopyEditValues } from "../components/CopyEditModal";
import { useConfirm, useToast } from "../components/FeedbackProvider";
import { useLibraries } from "../libraries/useLibraries";
import {
  type CommunityLoan,
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
} from "../lib/api";
import { readingStatusValueLabels } from "../lib/labels";

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

function formatBorrowerName(loan: CommunityLoan) {
  if (loan.borrower_name?.trim()) {
    return loan.borrower_name;
  }

  if (loan.borrower_user_id !== null) {
    return "Miembro de la biblioteca";
  }

  return "Prestatario desconocido";
}

export function BookDetailPage() {
  const confirm = useConfirm();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { notifySuccess } = useToast();
  const { libraries } = useLibraries();

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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteCopyErrorMessage, setDeleteCopyErrorMessage] = useState<string | null>(null);

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
    },
  });

  const deleteCopyMutation = useMutation({
    mutationFn: () => deleteCopyRequest(token ?? "", copyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      setDeleteCopyErrorMessage(null);
      notifySuccess("El ejemplar se ha eliminado del catálogo.");
      navigate("/catalogo", { replace: true });
    },
    onError: (error) => {
      setDeleteCopyErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar el ejemplar.");
    },
  });

  if (!isValidCopyId) {
    return (
      <section className="content-stack private-page-shell">
        <div className="panel">
          <p>El identificador del ejemplar no es valido.</p>
        </div>
      </section>
    );
  }

  const isLoading = copyQuery.isPending || userDataQuery.isPending;
  const isError = copyQuery.isError || userDataQuery.isError;
  const loadErrorMessage =
    copyQuery.error instanceof Error
      ? copyQuery.error.message
      : userDataQuery.error instanceof Error
        ? userDataQuery.error.message
        : "No se pudo cargar el detalle del libro.";
  const detail = copyQuery.data;
  const userData = userDataQuery.data;
  const library = detail ? libraries.find((item) => item.id === detail.library_id) ?? null : null;
  const isSharedLibrary = library?.type === "shared";
  const canEditCopy = Boolean(library && !library.is_archived && library.role !== "viewer");
  const canEditBook = Boolean(library && !library.is_archived && library.role === "owner");
  const canEditDetail = canEditBook || canEditCopy;
  const author = detail?.primary_author?.display_name ?? detail?.authors[0] ?? "Autor sin registrar";
  const genre = detail?.genre ?? "-";
  const themes = detail?.themes ?? [];
  const collection = detail?.collection ?? "-";
  const publisher = detail?.publisher ?? "-";
  const authorCountry = detail?.author_country ?? "-";
  const authorSex = detail?.author_sex ? authorSexLabels[detail.author_sex] : "-";
  const hasDescription = Boolean(detail?.description?.trim());
  const hasPersonalNotes = Boolean(userData?.personal_notes?.trim());
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
  const readingDetailPath = detail
    ? `/lectura?tab=${userData?.reading_status ?? "pending"}&library=${detail.library_id}&copy=${detail.id}`
    : "/lectura?tab=pending";
  const hasCommunityStats =
    (community?.public_review_count ?? 0) > 0 || community?.public_average_rating !== null;
  const hasCommunityLoan = Boolean(community?.active_loan);
  const hasCommunityReaders = Boolean(community?.shared_readers_count);
  const hasCommunityReviews = Boolean(community?.latest_reviews.length);
  const showCommunityBlock = Boolean(
    isSharedLibrary && (hasCommunityStats || hasCommunityLoan || hasCommunityReaders || hasCommunityReviews),
  );

  async function handleDelete() {
    const isConfirmed = await confirm({
      title: "Eliminar ejemplar",
      description: "Se borrará este ejemplar del catálogo y ya no estará disponible en la biblioteca.",
      confirmLabel: "Eliminar ejemplar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!isConfirmed) {
      return;
    }
    setDeleteCopyErrorMessage(null);
    await deleteCopyMutation.mutateAsync();
  }

  return (
    <section className="content-stack private-page-shell">
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
          <p>{loadErrorMessage}</p>
        </div>
      ) : null}

      {detail && userData ? (
        <div className="content-stack">
          <article className="panel detail-main-card">
            <div className="detail-hero">
              <div className="detail-cover-shell">
                <BookCover title={detail.title} coverUrl={detail.cover_url} />
              </div>

              <div className="detail-copy">
                <p className="eyebrow">Ficha del ejemplar</p>
                <h2>{detail.title}</h2>
                <p className="detail-author">{author}</p>

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
                    <dt>Editorial</dt>
                    <dd>{publisher}</dd>
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
                  {hasDescription ? (
                    <div className="detail-meta-item-full">
                      <dt>Descripcion</dt>
                      <dd>{detail.description}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="detail-actions">
                  {canEditDetail ? (
                    <button
                      className="ghost-link"
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      disabled={updateBookMutation.isPending || updateCopyMutation.isPending}
                    >
                      Editar
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

                {deleteCopyErrorMessage ? <p className="form-error">{deleteCopyErrorMessage}</p> : null}
              </div>
            </div>
          </article>

          <div className="panel detail-side-card content-stack">
            <div className="notes-header">
              <p className="eyebrow">Mi lectura</p>
              <Link className="ghost-link compact-action" to={readingDetailPath}>
                Editar
              </Link>
            </div>

            <dl className="reading-entry-meta">
              <div>
                <dt>Estado</dt>
                <dd>{readingStatusValueLabels[userData.reading_status]}</dd>
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

            {hasPersonalNotes ? (
              <div className="content-stack">
                <strong>Notas personales</strong>
                <p className="reading-notes-preview">{userData.personal_notes}</p>
              </div>
            ) : null}
          </div>

          {showCommunityBlock ? (
            <div className="panel detail-side-card content-stack">
              <p className="eyebrow">Comunidad</p>

              {hasCommunityStats ? (
                <div className="community-stat-row">
                  <span className="status-chip active">{community?.public_review_count ?? 0} resenas</span>
                  <span className="status-chip">{formatCommunityRating(community?.public_average_rating ?? null)}</span>
                </div>
              ) : null}

              {community?.active_loan ? (
                <div className="community-list-item">
                  <strong>Prestamo activo</strong>
                  <p>
                    Prestado a {formatBorrowerName(community.active_loan)}
                    {community.active_loan.due_date ? ` hasta ${formatDateLabel(community.active_loan.due_date)}` : ""}
                  </p>
                </div>
              ) : null}

              {hasCommunityReaders ? (
                <div className="content-stack">
                  <strong>Lectores actuales</strong>
                  {community?.shared_readers.map((reader) => <p key={reader.user_id}>{reader.name}</p>)}
                </div>
              ) : null}

              {hasCommunityReviews ? (
                <div className="content-stack">
                  <strong>Ultimas resenas</strong>
                  {community?.latest_reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="community-list-item">
                      <strong>
                        {review.user_name} - {review.rating}/5
                      </strong>
                      <p>{review.body ?? "Solo ha dejado una valoracion con estrellas."}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {library?.is_archived ? (
            <div className="panel subtle-panel">
              <p className="eyebrow">Biblioteca archivada</p>
              <p>Esta copia pertenece a una biblioteca archivada y no admite cambios de catalogo.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {detail ? (
        <BookDetailEditModal
          isOpen={isEditModalOpen}
          book={toBookMetadata(detail)}
          copy={detail}
          library={library}
          canEditBook={canEditBook}
          canEditCopy={canEditCopy}
          themeOptions={themesQuery.data ?? []}
          isSaving={updateBookMutation.isPending || updateCopyMutation.isPending}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={async (payload: BookDetailEditValues) => {
            if (canEditBook) {
              await updateBookMutation.mutateAsync(payload.book);
            }

            if (canEditCopy) {
              await updateCopyMutation.mutateAsync(payload.copy);
            }

            setIsEditModalOpen(false);
          }}
          token={token ?? ""}
        />
      ) : null}
    </section>
  );
}
