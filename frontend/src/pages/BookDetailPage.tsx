import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { BookModal, type BookFormValues } from "../components/BookModal";
import {
  deleteCopyRequest,
  fetchCopyById,
  fetchGenres,
  fetchUserCopyData,
  updateCopyRequest,
  updateUserCopyDataRequest,
  type Book,
  type BookUpdatePayload,
  type ReadingStatus,
  type UserCopyUpdatePayload,
} from "../lib/api";

const statusLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  finished: "Leido",
};

function toEditableBook(detail: Awaited<ReturnType<typeof fetchCopyById>>, userData: Awaited<ReturnType<typeof fetchUserCopyData>>): Book {
  return {
    ...detail,
    reading_status: userData.reading_status,
    user_rating: userData.rating,
  };
}

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: () => fetchGenres(token ?? ""),
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
    mutationFn: (payload: BookUpdatePayload) =>
      updateCopyRequest(token ?? "", copyId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["copy", copyId] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
        queryClient.invalidateQueries({ queryKey: ["genres"] }),
      ]);
      setIsEditModalOpen(false);
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
  const editableBook = detail && userData ? toEditableBook(detail, userData) : null;
  const author = detail?.authors[0] ?? "Autor sin registrar";
  const genre = detail?.genres[0] ?? "-";
  const coverLetter = (detail?.title.trim().slice(0, 1) || "?").toUpperCase();
  const isUserDataPending = updateUserDataMutation.isPending;

  async function handleBookSave(values: BookFormValues) {
    const payload: BookUpdatePayload = {
      title: values.title.trim(),
      authors: [values.author.trim()],
      publication_year: values.publicationYear.trim() ? Number(values.publicationYear) : null,
      isbn: values.isbn.trim() || null,
      genres: values.genre.trim() ? [values.genre.trim()] : [],
      cover_url: values.coverUrl.trim() || null,
    };

    await updateCopyMutation.mutateAsync(payload);
  }

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
    await updateUserDataMutation.mutateAsync({
      start_date: startDateDraft || null,
      end_date: endDateDraft || null,
    });
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
        ← Volver al catalogo
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
                    <dt>Genero</dt>
                    <dd>{genre}</dd>
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
                  <button
                    className="ghost-link"
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    disabled={updateCopyMutation.isPending}
                  >
                    Editar libro
                  </button>
                  <button
                    className="ghost-link danger-action"
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteCopyMutation.isPending}
                  >
                    {deleteCopyMutation.isPending ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <aside className="content-stack">
            <div className="panel detail-side-card">
              <p className="eyebrow">Seguimiento personal</p>

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
                      ★
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
          </aside>
        </div>
      ) : null}

      <BookModal
        book={editableBook}
        defaultLibraryId={editableBook?.library_id ?? null}
        genres={genresQuery.data ?? []}
        isOpen={isEditModalOpen && editableBook !== null}
        isSaving={updateCopyMutation.isPending}
        libraries={[]}
        mode="edit"
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleBookSave}
        token={token ?? ""}
      />
    </section>
  );
}
