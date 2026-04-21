import { useState } from "react";

import type { Book, UserList } from "../lib/api";

type AddToListModalProps = {
  book: Book | null;
  errorMessage: string | null;
  isOpen: boolean;
  isSaving: boolean;
  lists: UserList[];
  onClose: () => void;
  onSelectList: (list: UserList) => Promise<void>;
};

export function AddToListModal({
  book,
  errorMessage,
  isOpen,
  isSaving,
  lists,
  onClose,
  onSelectList,
}: AddToListModalProps) {
  const [submittingListId, setSubmittingListId] = useState<number | null>(null);

  if (!isOpen || !book) {
    return null;
  }

  async function handleSelectList(list: UserList) {
    setSubmittingListId(list.id);
    try {
      await onSelectList(list);
    } finally {
      setSubmittingListId(null);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel narrow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Listas personales</p>
            <h2 id="add-to-list-title">Añadir "{book.title}"</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="content-stack">
          {lists.length === 0 ? (
            <div className="empty-state subtle-panel">
              <h3>No hay listas disponibles.</h3>
              <p>Crea una lista nueva desde "Mis listas" para guardar este libro.</p>
            </div>
          ) : (
            <div className="content-stack">
              {lists.map((list) => (
                <button
                  key={list.id}
                  className="list-picker"
                  type="button"
                  onClick={() => handleSelectList(list)}
                  disabled={isSaving}
                >
                  <span>
                    <strong>{list.name}</strong>
                    <small>
                      {list.library_id === null ? "Global" : "Biblioteca activa"} · {list.book_count} libros
                    </small>
                  </span>
                  <span>
                    {isSaving && submittingListId === list.id ? "Guardando..." : "Añadir"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
