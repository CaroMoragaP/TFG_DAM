import { useEffect, useState, type FormEvent } from "react";

import { ApiError, type BookMetadata } from "../lib/api";

export type BookMetadataValues = {
  title: string;
  author: string;
  publicationYear: string;
  isbn: string;
  genre: string;
  coverUrl: string;
  description: string;
  publisherName: string;
};

type BookMetadataModalProps = {
  book: BookMetadata | null;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: BookMetadataValues) => Promise<void>;
};

type FormErrors = Partial<Record<keyof BookMetadataValues | "form", string>>;

function emptyValues(): BookMetadataValues {
  return {
    title: "",
    author: "",
    publicationYear: "",
    isbn: "",
    genre: "",
    coverUrl: "",
    description: "",
    publisherName: "",
  };
}

function toFormValues(book: BookMetadata): BookMetadataValues {
  return {
    title: book.title,
    author: book.authors[0] ?? "",
    publicationYear: book.publication_year ? String(book.publication_year) : "",
    isbn: book.isbn ?? "",
    genre: book.genres[0] ?? "",
    coverUrl: book.cover_url ?? "",
    description: book.description ?? "",
    publisherName: book.publisher ?? "",
  };
}

export function BookMetadataModal({
  book,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}: BookMetadataModalProps) {
  const [formValues, setFormValues] = useState<BookMetadataValues>(emptyValues());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!isOpen || !book) {
      return;
    }

    setErrors({});
    setFormValues(toFormValues(book));
  }, [book, isOpen]);

  if (!isOpen || !book) {
    return null;
  }

  function handleFieldChange<Field extends keyof BookMetadataValues>(
    field: Field,
    value: BookMetadataValues[Field],
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
            : "No se pudo guardar la ficha del libro.",
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-metadata-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Ficha canónica</p>
            <h2 id="book-metadata-modal-title">Editar libro</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            <label className="field-group">
              Título
              <input value={formValues.title} onChange={(event) => handleFieldChange("title", event.target.value)} />
            </label>

            <label className="field-group">
              Autor principal
              <input value={formValues.author} onChange={(event) => handleFieldChange("author", event.target.value)} />
            </label>

            <label className="field-group">
              Año
              <input
                inputMode="numeric"
                value={formValues.publicationYear}
                onChange={(event) => handleFieldChange("publicationYear", event.target.value)}
              />
            </label>

            <label className="field-group">
              ISBN
              <input value={formValues.isbn} onChange={(event) => handleFieldChange("isbn", event.target.value)} />
            </label>

            <label className="field-group">
              Género principal
              <input value={formValues.genre} onChange={(event) => handleFieldChange("genre", event.target.value)} />
            </label>

            <label className="field-group">
              Editorial
              <input
                value={formValues.publisherName}
                onChange={(event) => handleFieldChange("publisherName", event.target.value)}
              />
            </label>

            <label className="field-group">
              URL de portada
              <input value={formValues.coverUrl} onChange={(event) => handleFieldChange("coverUrl", event.target.value)} />
            </label>

            <label className="field-group">
              Descripción
              <textarea
                className="notes-textarea"
                rows={4}
                value={formValues.description}
                onChange={(event) => handleFieldChange("description", event.target.value)}
              />
            </label>
          </div>

          {errors.form ? <p className="form-error">{errors.form}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar ficha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
