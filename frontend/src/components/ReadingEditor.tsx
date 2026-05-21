import { Link } from "react-router-dom";

import { type ReadingShelfItem, type ReadingStatus } from "../lib/api";
import { readingStatusValueLabels } from "../lib/labels";

export type ReadingEditorState = {
  readingStatus: ReadingStatus;
  rating: number | null;
  startDate: string;
  endDate: string;
  personalNotes: string;
  publicReviewBody: string;
};

type ReadingEditorProps = {
  item: ReadingShelfItem;
  editorState: ReadingEditorState;
  isSharedItem: boolean;
  saveReadingErrorMessage: string | null;
  reviewErrorMessage: string | null;
  deleteReviewErrorMessage: string | null;
  isSaving: boolean;
  isReviewSaving: boolean;
  isReviewDeleting: boolean;
  onReadingStatusChange: (nextStatus: ReadingStatus) => void;
  onRatingChange: (nextRating: number) => void;
  onStartDateChange: (nextStartDate: string) => void;
  onEndDateChange: (nextEndDate: string) => void;
  onPersonalNotesChange: (nextNotes: string) => void;
  onPublicReviewBodyChange: (nextBody: string) => void;
  onPublishReview: () => void;
  onDeleteReview: () => void;
  onSave: () => void;
  onCancel: () => void;
};

function formatCommunityRating(value: number | null) {
  return value === null ? "Sin media publica" : `${value.toFixed(1)}/5`;
}

export function ReadingEditor({
  item,
  editorState,
  isSharedItem,
  saveReadingErrorMessage,
  reviewErrorMessage,
  deleteReviewErrorMessage,
  isSaving,
  isReviewSaving,
  isReviewDeleting,
  onReadingStatusChange,
  onRatingChange,
  onStartDateChange,
  onEndDateChange,
  onPersonalNotesChange,
  onPublicReviewBodyChange,
  onPublishReview,
  onDeleteReview,
  onSave,
  onCancel,
}: ReadingEditorProps) {
  return (
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
            onChange={(event) => onReadingStatusChange(event.target.value as ReadingStatus)}
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
                aria-label={`Valorar ${item.title} con ${star} estrellas`}
                onClick={() => onRatingChange(star)}
              >
                *
              </button>
            ))}
          </div>
          <p className="detail-inline-copy">{editorState.rating ? `${editorState.rating}/5` : "Sin valoracion"}</p>
        </div>

        <label className="field-group">
          Fecha de inicio
          <input type="date" value={editorState.startDate} onChange={(event) => onStartDateChange(event.target.value)} />
        </label>

        <label className="field-group">
          Fecha de fin
          <input type="date" value={editorState.endDate} onChange={(event) => onEndDateChange(event.target.value)} />
        </label>

        <label className="field-group field-span-full">
          Notas personales
          <textarea
            className="notes-textarea"
            rows={5}
            value={editorState.personalNotes}
            onChange={(event) => onPersonalNotesChange(event.target.value)}
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
            Tu valoracion personal es la nota canonica. Si la publicas, la comunidad vera esa misma puntuacion junto con
            tu comentario opcional.
          </p>

          <label className="field-group">
            Comentario publico
            <textarea
              className="notes-textarea"
              rows={4}
              value={editorState.publicReviewBody}
              onChange={(event) => onPublicReviewBodyChange(event.target.value)}
              placeholder="Comparte por que merece la pena leerlo..."
            />
          </label>

          <div className="inline-actions">
            <button
              className="submit-button compact-button"
              type="button"
              onClick={onPublishReview}
              disabled={isReviewSaving || isSaving || editorState.rating === null}
            >
              {item.my_public_review ? "Actualizar publicacion" : "Publicar mi valoracion"}
            </button>
            {item.my_public_review ? (
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={onDeleteReview}
                disabled={isReviewDeleting}
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
          {reviewErrorMessage ? <p className="form-error">{reviewErrorMessage}</p> : null}
          {deleteReviewErrorMessage ? <p className="form-error">{deleteReviewErrorMessage}</p> : null}
        </div>
      ) : null}

      {saveReadingErrorMessage ? (
        <p className="form-error reading-save-error" role="alert">
          {saveReadingErrorMessage}
        </p>
      ) : null}

      <div className="inline-actions">
        <button className="submit-button compact-button" type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar lectura"}
        </button>
        <button className="ghost-link compact-action" type="button" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
