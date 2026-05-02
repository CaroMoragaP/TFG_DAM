import { useEffect, useState, type FormEvent } from "react";

import { ApiError, type AuthorSex, type BookMetadata } from "../lib/api";

export type BookMetadataValues = {
  title: string;
  authorFirstName: string;
  authorLastName: string;
  authorSex: AuthorSex | "";
  authorCountry: string;
  publicationYear: string;
  isbn: string;
  genre: string;
  collection: string;
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
    authorFirstName: "",
    authorLastName: "",
    authorSex: "",
    authorCountry: "",
    publicationYear: "",
    isbn: "",
    genre: "",
    collection: "",
    coverUrl: "",
    description: "",
    publisherName: "",
  };
}

function toFormValues(book: BookMetadata): BookMetadataValues {
  return {
    title: book.title,
    authorFirstName: book.primary_author?.first_name ?? book.primary_author?.display_name ?? "",
    authorLastName: book.primary_author?.last_name ?? "",
    authorSex: book.author_sex ?? "",
    authorCountry: book.author_country ?? "",
    publicationYear: book.publication_year ? String(book.publication_year) : "",
    isbn: book.isbn ?? "",
    genre: book.genres[0] ?? "",
    collection: book.collection ?? "",
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
            <p className="eyebrow">Ficha canonica</p>
            <h2 id="book-metadata-modal-title">Editar libro</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            <label className="field-group">
              Titulo
              <input value={formValues.title} onChange={(event) => handleFieldChange("title", event.target.value)} />
            </label>

            <label className="field-group">
              Nombre del autor principal
              <input
                value={formValues.authorFirstName}
                onChange={(event) => handleFieldChange("authorFirstName", event.target.value)}
              />
            </label>

            <label className="field-group">
              Apellido del autor principal
              <input
                value={formValues.authorLastName}
                onChange={(event) => handleFieldChange("authorLastName", event.target.value)}
              />
            </label>

            <label className="field-group">
              Sexo del autor principal
              <select
                value={formValues.authorSex}
                onChange={(event) => handleFieldChange("authorSex", event.target.value as AuthorSex | "")}
              >
                <option value="">Sin dato</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
                <option value="non_binary">No binario</option>
                <option value="unknown">Desconocido</option>
              </select>
            </label>

            <label className="field-group">
              Pais del autor principal
              <input
                value={formValues.authorCountry}
                onChange={(event) => handleFieldChange("authorCountry", event.target.value)}
              />
            </label>

            <label className="field-group">
              Ano
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
              Genero principal
              <input value={formValues.genre} onChange={(event) => handleFieldChange("genre", event.target.value)} />
            </label>

            <label className="field-group">
              Coleccion
              <input
                value={formValues.collection}
                onChange={(event) => handleFieldChange("collection", event.target.value)}
              />
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
              <input
                value={formValues.coverUrl}
                onChange={(event) => handleFieldChange("coverUrl", event.target.value)}
              />
            </label>

            <label className="field-group">
              Descripcion
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
