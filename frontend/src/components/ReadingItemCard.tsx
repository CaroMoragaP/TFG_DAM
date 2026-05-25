import { Link } from "react-router-dom";

import { BookCover } from "./BookCover";
import { ReadingEditor, type ReadingEditorState } from "./ReadingEditor";
import { type Library, type ReadingShelfItem, type ReadingStatus } from "../lib/api";

type ReadingItemCardProps = {
  item: ReadingShelfItem;
  library: Library | null;
  tab: ReadingStatus;
  showLibraryBadge: boolean;
  isEditing: boolean;
  editorState: ReadingEditorState | null;
  saveReadingErrorMessage: string | null;
  reviewErrorMessage: string | null;
  deleteReviewErrorMessage: string | null;
  isSaving: boolean;
  isReviewSaving: boolean;
  isReviewDeleting: boolean;
  onToggleEditor: () => void;
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

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCommunityRating(value: number | null) {
  return value === null ? "Sin media pública" : `${value.toFixed(1)}/5`;
}

export function ReadingItemCard({
  item,
  library,
  tab,
  showLibraryBadge,
  isEditing,
  editorState,
  saveReadingErrorMessage,
  reviewErrorMessage,
  deleteReviewErrorMessage,
  isSaving,
  isReviewSaving,
  isReviewDeleting,
  onToggleEditor,
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
}: ReadingItemCardProps) {
  const isSharedItem = library?.type === "shared";

  return (
    <article className="panel reading-entry-card">
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
              <button className="ghost-link compact-action" type="button" onClick={onToggleEditor}>
                {isEditing ? "Cerrar editor" : "Gestionar lectura"}
              </button>
              <Link className="ghost-link compact-action" to={`/ejemplar/${item.copy_id}`}>
                Abrir ficha
              </Link>
            </div>
          </div>

          <dl className="reading-entry-meta">
            <div>
              <dt>Valoración</dt>
              <dd>{item.rating ? `${item.rating}/5` : "-"}</dd>
            </div>
            <div>
              <dt>{tab === "finished" ? "Fecha fin" : "Fecha inicio"}</dt>
              <dd>{formatDateLabel(tab === "finished" ? item.end_date : item.start_date)}</dd>
            </div>
            <div>
              <dt>Colección</dt>
              <dd>{item.collection ?? "-"}</dd>
            </div>
          </dl>

          <div className={item.personal_notes ? "reading-entry-footer has-notes" : "reading-entry-footer"}>
            <div className="reading-entry-badges">
              {showLibraryBadge && library ? <span className="library-badge">{library.name}</span> : null}
              {item.my_public_review ? <span className="status-chip active">Publicada</span> : null}
              {isSharedItem && item.public_review_count > 0 ? (
                <span className="status-chip">
                  {item.public_review_count} reseñas · {formatCommunityRating(item.public_average_rating)}
                </span>
              ) : null}
            </div>
            {item.personal_notes ? <p className="reading-notes-preview">{item.personal_notes}</p> : null}
          </div>
        </div>
      </div>

      {isEditing && editorState ? (
        <ReadingEditor
          item={item}
          editorState={editorState}
          isSharedItem={isSharedItem}
          saveReadingErrorMessage={saveReadingErrorMessage}
          reviewErrorMessage={reviewErrorMessage}
          deleteReviewErrorMessage={deleteReviewErrorMessage}
          isSaving={isSaving}
          isReviewSaving={isReviewSaving}
          isReviewDeleting={isReviewDeleting}
          onReadingStatusChange={onReadingStatusChange}
          onRatingChange={onRatingChange}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onPersonalNotesChange={onPersonalNotesChange}
          onPublicReviewBodyChange={onPublicReviewBodyChange}
          onPublishReview={onPublishReview}
          onDeleteReview={onDeleteReview}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : null}
    </article>
  );
}
