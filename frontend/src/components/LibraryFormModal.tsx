import { useEffect, useState, type FormEvent } from "react";

import type { LibraryCreatePayload, LibraryType } from "../lib/api";

type LibraryFormModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: LibraryCreatePayload) => Promise<void>;
};

const typeDescriptions: Record<LibraryType, string> = {
  personal: "Solo tuya, ideal para organizar tu espacio personal.",
  shared: "Compartida con otras personas para colaborar en una misma biblioteca.",
};

export function LibraryFormModal({
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}: LibraryFormModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LibraryType>("shared");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName("");
    setType("shared");
    setErrorMessage(null);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setErrorMessage("El nombre es obligatorio.");
      return;
    }

    setErrorMessage(null);
    try {
      await onSubmit({
        name: name.trim(),
        type,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la biblioteca.",
      );
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel narrow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Mis bibliotecas</p>
            <h2 id="library-form-title">Añadir biblioteca</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-group">
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="field-group">
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as LibraryType)}>
              <option value="shared">Compartida</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <div className="subtle-panel modal-info-panel">
            <p className="eyebrow">Visibilidad</p>
            <p>{typeDescriptions[type]}</p>
          </div>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Crear biblioteca"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
