type ConfirmDialogProps = {
  description?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  title: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  description,
  isOpen,
  isSubmitting = false,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  title,
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel panel narrow-modal confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Confirmación</p>
            <h2 id="confirm-dialog-title">{title}</h2>
            {description ? <p className="confirm-dialog-copy">{description}</p> : null}
          </div>
        </div>

        <div className="modal-actions">
          <button className="ghost-link" type="button" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "ghost-link danger-action" : "submit-button"}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
