import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookMetadataModal, type BookMetadataValues } from "../components/BookMetadataModal";
import { CopyEditModal, type CopyEditValues } from "../components/CopyEditModal";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  deleteCopyRequest,
  fetchCopyById,
  fetchThemes,
  fetchUserCopyData,
  updateBookMetadataRequest,
  updateCopyRequest,
  updateUserCopyDataRequest,
  type BookMetadata,
  type CopyDetail,
  type ReadingStatus,
  type UserCopyUpdatePayload,
} from "../lib/api";
import { deriveReadingStatusFromDates } from "../lib/readingProgress";

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

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { libraries } = useActiveLibrary();
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [startDateDraft, setStartDateDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");

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

  useEffect(() => {
    setNotesDraft(userDataQuery.data?.personal_notes ?? "");
    setStartDateDraft(userDataQuery.data?.start_date ?? "");
    setEndDateDraft(userDataQuery.data?.end_date ?? "");
  }, [userDataQuery.data]);

  const updateUserDataMutation = useMutation({
    mutationFn: (payload: UserCopyUpdatePayload) =>
      updateUserCopyDataRequest(token ?? "", copyId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["copy-user-data", copyId] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]);
    },
  });

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
  const canEditCopy = Boolean(library && !library.is_archived && library.role !== "viewer");
  const canEditBook = Boolean(library && !library.is_archived && library.role === "owner");
  const author = detail?.primary_author?.display_name ?? detail?.authors[0] ?? "Autor sin registrar";
  const genre = detail?.genre ?? "-";
  const themes = detail?.themes ?? [];
  const collection = detail?.collection ?? "-";
  const authorCountry = detail?.author_country ?? "-";
  const authorSex = detail?.author_sex ? authorSexLabels[detail.author_sex] : "-";
  const coverLetter = (detail?.title.trim().slice(0, 1) || "?").toUpperCase();
  const isUserDataPending = updateUserDataMutation.isPending;

  async function handleStatusChange(nextStatus: ReadingStatus) {
    await updateUserDataMutation.mutateAsync({ reading_status: nextStatus });
  }

  async function handleRatingChange(nextRating: number) {
    const currentRating = userData?.rating ?? null;
    await updateUserDataMutation.mutateAsync({
      rating: currentRating === nextRating ? null : nextRating,
    });
  }

  async function handleSaveNotes() {
    await updateUserDataMutation.mutateAsync({
      personal_notes: notesDraft,
    });
    setIsEditingNotes(false);
  }

  async function handleSaveDates() {
    const payload: UserCopyUpdatePayload = {
      start_date: startDateDraft || null,
      end_date: endDateDraft || null,
    };
    const nextStatus = deriveReadingStatusFromDates(
      userData?.reading_status ?? "pending",
      startDateDraft,
      endDateDraft,
    );

    if (nextStatus !== userData?.reading_status) {
      payload.reading_status = nextStatus;
    }

    await updateUserDataMutation.mutateAsync(payload);
  }

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
            <div className="panel detail-side-card">
              <div className="notes-header">
                <div>
                  <p className="eyebrow">Mi lectura</p>
                  <p className="detail-inline-copy">
                    Puedes gestionar este seguimiento tambien desde la seccion{" "}
                    <Link to={`/lectura?tab=${userData.reading_status}`}>Lectura</Link>.
                  </p>
                </div>
              </div>

              <label className="field-group">
                Estado
                <select
                  value={userData.reading_status}
                  onChange={(event) => handleStatusChange(event.target.value as ReadingStatus)}
                  disabled={isUserDataPending}
                >
                  <option value="pending">Pendiente</option>
                  <option value="reading">Leyendo</option>
                  <option value="finished">Leido</option>
                </select>
              </label>

              <div className="rating-block">
                <span className="eyebrow">Valoracion</span>
                <div className="star-row" role="group" aria-label="Valorar libro">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={star <= (userData.rating ?? 0) ? "star-button active" : "star-button"}
                      type="button"
                      onClick={() => handleRatingChange(star)}
                      disabled={isUserDataPending}
                      aria-label={`Valorar con ${star} estrellas`}
                    >
                      *
                    </button>
                  ))}
                </div>
                <p className="detail-inline-copy">
                  {userData.rating ? `${userData.rating}/5` : "Sin valoracion"}
                </p>
              </div>

              <div className="notes-card">
                <div className="notes-header">
                  <div>
                    <p className="eyebrow">Mis notas</p>
                  </div>
                  {!isEditingNotes ? (
                    <button className="ghost-link compact-action" type="button" onClick={() => setIsEditingNotes(true)}>
                      Editar
                    </button>
                  ) : null}
                </div>

                {isEditingNotes ? (
                  <div className="content-stack">
                    <textarea
                      className="notes-textarea"
                      rows={6}
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                    />
                    <div className="inline-actions">
                      <button
                        className="submit-button compact-button"
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={isUserDataPending}
                      >
                        Guardar
                      </button>
                      <button
                        className="ghost-link compact-action"
                        type="button"
                        onClick={() => {
                          setNotesDraft(userData.personal_notes ?? "");
                          setIsEditingNotes(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="notes-preview">{userData.personal_notes ?? "Todavia no has anadido notas."}</p>
                )}
              </div>
            </div>

            <div className="panel detail-side-card">
              <p className="eyebrow">Fechas de lectura</p>
              <div className="detail-dates-grid">
                <label className="field-group">
                  Inicio
                  <input
                    type="date"
                    value={startDateDraft}
                    onChange={(event) => setStartDateDraft(event.target.value)}
                  />
                </label>
                <label className="field-group">
                  Fin
                  <input
                    type="date"
                    value={endDateDraft}
                    onChange={(event) => setEndDateDraft(event.target.value)}
                  />
                </label>
              </div>
              <p className="detail-inline-copy">Estado actual: {statusLabels[userData.reading_status]}</p>
              <button
                className="submit-button"
                type="button"
                onClick={handleSaveDates}
                disabled={isUserDataPending}
              >
                Guardar fechas
              </button>
              {updateUserDataMutation.isError ? (
                <p className="form-error">
                  {updateUserDataMutation.error instanceof Error
                    ? updateUserDataMutation.error.message
                    : "No se pudieron guardar los datos personales."}
                </p>
              ) : null}
            </div>

            {library?.is_archived ? (
              <div className="panel subtle-panel">
                <p className="eyebrow">Biblioteca archivada</p>
                <p>Esta copia pertenece a una biblioteca archivada y no admite cambios de catalogo.</p>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      <CopyEditModal
        copy={detail ?? null}
        library={library}
        isOpen={isCopyModalOpen}
        isSaving={updateCopyMutation.isPending}
        onClose={() => setIsCopyModalOpen(false)}
        onSubmit={async (values) => {
          await updateCopyMutation.mutateAsync(values);
        }}
      />

      <BookMetadataModal
        book={detail ? toBookMetadata(detail) : null}
        isOpen={isBookModalOpen}
        isSaving={updateBookMutation.isPending}
        themeOptions={themesQuery.data ?? []}
        onClose={() => setIsBookModalOpen(false)}
        onSubmit={async (values) => {
          await updateBookMutation.mutateAsync(values);
        }}
      />
    </section>
  );
}
