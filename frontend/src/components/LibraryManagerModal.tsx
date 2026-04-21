import { useState, type FormEvent } from "react";

import type {
  Library,
  LibraryCreatePayload,
  LibraryType,
  LibraryUpdatePayload,
} from "../lib/api";

type LibraryManagerModalProps = {
  activeLibraryId: number | null;
  isOpen: boolean;
  isSaving: boolean;
  libraries: Library[];
  onClose: () => void;
  onCreate: (payload: LibraryCreatePayload) => Promise<void>;
  onRename: (libraryId: number, payload: LibraryUpdatePayload) => Promise<void>;
  onSelectActive: (libraryId: number) => void;
};

const typeLabels: Record<LibraryType, string> = {
  personal: "Personal",
  shared: "Compartida",
};

export function LibraryManagerModal({
  activeLibraryId,
  isOpen,
  isSaving,
  libraries,
  onClose,
  onCreate,
  onRename,
  onSelectActive,
}: LibraryManagerModalProps) {
  const [newLibraryName, setNewLibraryName] = useState("");
  const [newLibraryType, setNewLibraryType] = useState<LibraryType>("shared");
  const [editingLibraryId, setEditingLibraryId] = useState<number | null>(null);
  const [editingLibraryName, setEditingLibraryName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLibraryName.trim()) {
      setErrorMessage("El nombre de la biblioteca es obligatorio.");
      return;
    }

    setErrorMessage(null);
    try {
      await onCreate({
        name: newLibraryName.trim(),
        type: newLibraryType,
      });
      setNewLibraryName("");
      setNewLibraryType("shared");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la biblioteca.",
      );
    }
  }

  async function handleRename(libraryId: number) {
    if (!editingLibraryName.trim()) {
      setErrorMessage("El nombre no puede estar vacio.");
      return;
    }

    setErrorMessage(null);
    try {
      await onRename(libraryId, { name: editingLibraryName.trim() });
      setEditingLibraryId(null);
      setEditingLibraryName("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo renombrar la biblioteca.",
      );
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel wide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-manager-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Bibliotecas</p>
            <h2 id="library-manager-title">Gestionar mis bibliotecas</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="split-panel">
          <form className="panel subtle-panel" onSubmit={handleCreate}>
            <p className="eyebrow">Nueva biblioteca</p>
            <label className="field-group">
              Nombre
              <input
                value={newLibraryName}
                onChange={(event) => setNewLibraryName(event.target.value)}
              />
            </label>

            <label className="field-group">
              Tipo
              <select
                value={newLibraryType}
                onChange={(event) => setNewLibraryType(event.target.value as LibraryType)}
              >
                <option value="shared">Compartida</option>
                <option value="personal">Personal</option>
              </select>
            </label>

            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Crear biblioteca"}
            </button>
          </form>

          <div className="content-stack">
            {libraries.map((library) => {
              const isEditing = editingLibraryId === library.id;
              return (
                <article key={library.id} className="panel library-manager-card">
                  <div className="library-manager-header">
                    <div>
                      <h3>{library.name}</h3>
                      <p>
                        {typeLabels[library.type]} · {library.role === "owner" ? "Propietario" : "Miembro"}
                      </p>
                    </div>
                    <span className={library.id === activeLibraryId ? "status-chip active" : "status-chip"}>
                      {library.id === activeLibraryId ? "Activa" : "Disponible"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="inline-edit">
                      <input
                        value={editingLibraryName}
                        onChange={(event) => setEditingLibraryName(event.target.value)}
                      />
                      <button
                        className="submit-button compact-button"
                        type="button"
                        onClick={() => handleRename(library.id)}
                        disabled={isSaving}
                      >
                        Guardar
                      </button>
                    </div>
                  ) : null}

                  <div className="inline-actions">
                    <button
                      className="ghost-link compact-action"
                      type="button"
                      onClick={() => onSelectActive(library.id)}
                    >
                      Usar
                    </button>
                    {library.role === "owner" ? (
                      <button
                        className="ghost-link compact-action"
                        type="button"
                        onClick={() => {
                          setEditingLibraryId(library.id);
                          setEditingLibraryName(library.name);
                        }}
                      >
                        Renombrar
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      </div>
    </div>
  );
}
