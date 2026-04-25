import { useEffect, useState, type FormEvent } from "react";

import { ApiError, type CopyDetail, type CopyFormat, type CopyStatus, type Library } from "../lib/api";

export type CopyEditValues = {
  format: CopyFormat;
  status: CopyStatus;
  physicalLocation: string;
  digitalLocation: string;
};

type CopyEditModalProps = {
  copy: CopyDetail | null;
  library?: Library | null;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: CopyEditValues) => Promise<void>;
};

type FormErrors = Partial<Record<keyof CopyEditValues | "form", string>>;

function emptyValues(): CopyEditValues {
  return {
    format: "physical",
    status: "available",
    physicalLocation: "",
    digitalLocation: "",
  };
}

function toFormValues(copy: CopyDetail): CopyEditValues {
  return {
    format: copy.format,
    status: copy.status,
    physicalLocation: copy.physical_location ?? "",
    digitalLocation: copy.digital_location ?? "",
  };
}

export function CopyEditModal({
  copy,
  library,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}: CopyEditModalProps) {
  const [formValues, setFormValues] = useState<CopyEditValues>(emptyValues());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!isOpen || !copy) {
      return;
    }

    setErrors({});
    setFormValues(toFormValues(copy));
  }, [copy, isOpen]);

  if (!isOpen || !copy) {
    return null;
  }

  function handleFieldChange<Field extends keyof CopyEditValues>(
    field: Field,
    value: CopyEditValues[Field],
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => {
      if (!currentErrors[field] && !currentErrors.form) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      delete nextErrors.form;
      return nextErrors;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    try {
      await onSubmit(formValues);
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "No se pudo guardar el ejemplar.",
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-edit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Ejemplar local</p>
            <h2 id="copy-edit-modal-title">Editar ejemplar</h2>
            <p>{library?.name ?? "Biblioteca"}</p>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field-group">
              Título
              <div className="readonly-field">{copy.title}</div>
            </div>

            <label className="field-group">
              Formato
              <select
                value={formValues.format}
                onChange={(event) => handleFieldChange("format", event.target.value as CopyFormat)}
              >
                <option value="physical">Físico</option>
                <option value="digital">Digital</option>
              </select>
            </label>

            <label className="field-group">
              Estado
              <select
                value={formValues.status}
                onChange={(event) => handleFieldChange("status", event.target.value as CopyStatus)}
              >
                <option value="available">Disponible</option>
                <option value="loaned">Prestado</option>
                <option value="reserved">Reservado</option>
              </select>
            </label>

            <label className="field-group">
              Ubicación física
              <input
                value={formValues.physicalLocation}
                onChange={(event) => handleFieldChange("physicalLocation", event.target.value)}
              />
            </label>

            <label className="field-group">
              Ubicación digital
              <input
                value={formValues.digitalLocation}
                onChange={(event) => handleFieldChange("digitalLocation", event.target.value)}
              />
            </label>
          </div>

          {errors.form ? <p className="form-error">{errors.form}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar ejemplar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
