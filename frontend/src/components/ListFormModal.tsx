import { useEffect, useState, type FormEvent } from "react";

import type { ListCreatePayload, ListType, UserList } from "../lib/api";

type ListFormModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  list: UserList | null;
  onClose: () => void;
  onSubmit: (payload: ListCreatePayload) => Promise<void>;
};

const typeLabels: Record<ListType, string> = {
  wishlist: "Favoritos",
  pending: "Pendientes",
  custom: "Personalizada",
};

export function ListFormModal({
  isOpen,
  isSaving,
  list,
  onClose,
  onSubmit,
}: ListFormModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ListType>("custom");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(list?.name ?? "");
    setType(list?.type ?? "custom");
    setErrorMessage(null);
  }, [isOpen, list]);

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
        error instanceof Error ? error.message : "No se pudo guardar la lista.",
      );
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel narrow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Mis listas</p>
            <h2 id="list-form-title">{list ? "Editar lista" : "Crear lista"}</h2>
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
            <select value={type} onChange={(event) => setType(event.target.value as ListType)}>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="subtle-panel">
            <p className="eyebrow">Visibilidad</p>
            <p>La lista estara disponible para guardar libros de cualquiera de tus bibliotecas.</p>
          </div>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : list ? "Guardar lista" : "Crear lista"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
