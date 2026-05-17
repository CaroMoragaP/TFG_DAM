import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { ApiError, fetchOpenLibraryBook, type AuthorSex, type BookMetadata, type ExternalBookLookup, type Library } from "../lib/api";
import {
  LITERARY_GENRE_OPTIONS,
  MAX_BOOK_THEMES,
  normalizeThemeSelection,
  validateSharedBookFields,
} from "../lib/bookMetadata";
import { ThemeSelector } from "./ThemeSelector";

export type BookMetadataValues = {
  title: string;
  authorFirstName: string;
  authorLastName: string;
  authorSex: AuthorSex | "";
  authorCountry: string;
  publicationYear: string;
  isbn: string;
  genre: string;
  themes: string[];
  collection: string;
  coverUrl: string;
  description: string;
  publisherName: string;
};

type BookMetadataModalProps = {
  book: BookMetadata | null;
  isOpen: boolean;
  isSaving: boolean;
  library?: Library | null;
  themeOptions: string[];
  onClose: () => void;
  onSubmit: (values: BookMetadataValues) => Promise<void>;
  token: string;
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
    themes: [],
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
    genre: book.genre ?? "",
    themes: normalizeThemeSelection(book.themes),
    collection: book.collection ?? "",
    coverUrl: book.cover_url ?? "",
    description: book.description ?? "",
    publisherName: book.publisher ?? "",
  };
}

function buildAuthorDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function applyImportedBook(
  values: BookMetadataValues,
  importedBook: ExternalBookLookup,
): BookMetadataValues {
  return {
    ...values,
    title: importedBook.title,
    authorFirstName:
      importedBook.primary_author?.first_name ??
      importedBook.primary_author?.display_name ??
      importedBook.authors[0] ??
      "",
    authorLastName: importedBook.primary_author?.last_name ?? "",
    publicationYear: importedBook.publication_year ? String(importedBook.publication_year) : "",
    isbn: importedBook.isbn ?? "",
    publisherName: importedBook.publisher_name ?? "",
    themes: normalizeThemeSelection(importedBook.themes),
    coverUrl: importedBook.cover_url ?? "",
  };
}

export function BookMetadataModal({
  book,
  isOpen,
  isSaving,
  library,
  themeOptions,
  onClose,
  onSubmit,
  token,
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const isbn = formValues.isbn.trim();
      const title = formValues.title.trim();
      const author = buildAuthorDisplayName(formValues.authorFirstName, formValues.authorLastName);
      const publisher = formValues.publisherName.trim();

      if (!isbn && !title) {
        throw new Error("Escribe un ISBN o un titulo antes de buscar.");
      }

      return fetchOpenLibraryBook(
        token,
        isbn
          ? { isbn }
          : {
              title,
              author: author || undefined,
              publisher: publisher || undefined,
            },
      );
    },
    onSuccess: (importedBook) => {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.form;
        delete nextErrors.title;
        delete nextErrors.authorFirstName;
        delete nextErrors.authorLastName;
        delete nextErrors.authorCountry;
        delete nextErrors.publicationYear;
        delete nextErrors.isbn;
        delete nextErrors.genre;
        delete nextErrors.themes;
        delete nextErrors.collection;
        delete nextErrors.coverUrl;
        delete nextErrors.publisherName;
        return nextErrors;
      });
      setFormValues((currentValues) => applyImportedBook(currentValues, importedBook));
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "No se pudo importar informacion desde Open Library.";
      setErrors((currentErrors) => ({
        ...currentErrors,
        form: message,
      }));
    },
  });

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
    const nextErrors = validateSharedBookFields({
      title: formValues.title,
      authorFirstName: formValues.authorFirstName,
      authorLastName: formValues.authorLastName,
      publicationYear: formValues.publicationYear,
      coverUrl: formValues.coverUrl,
      themes: formValues.themes,
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

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
            <p className="detail-inline-copy modal-subtitle">
              Busca por ISBN o por titulo, nombre y editorial.
            </p>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field-group">
              Biblioteca
              <div className="readonly-field">{library?.name ?? "Biblioteca"}</div>
            </div>

            <label className="field-group">
              ISBN
              <div className="compound-field">
                <input value={formValues.isbn} onChange={(event) => handleFieldChange("isbn", event.target.value)} />
                <button
                  className="ghost-link compact-action"
                  type="button"
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? "Buscando..." : "Buscar en Open Library"}
                </button>
              </div>
            </label>

            <label className="field-group">
              Titulo
              <input value={formValues.title} onChange={(event) => handleFieldChange("title", event.target.value)} />
              {errors.title ? <p className="field-error">{errors.title}</p> : null}
            </label>

            <label className="field-group">
              Editorial
              <input
                value={formValues.publisherName}
                onChange={(event) => handleFieldChange("publisherName", event.target.value)}
              />
            </label>

            <label className="field-group">
              Nombre del autor
              <input
                value={formValues.authorFirstName}
                onChange={(event) => handleFieldChange("authorFirstName", event.target.value)}
              />
              {errors.authorFirstName ? <p className="field-error">{errors.authorFirstName}</p> : null}
            </label>

            <label className="field-group">
              Apellido del autor
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
              {errors.publicationYear ? <p className="field-error">{errors.publicationYear}</p> : null}
            </label>

            <label className="field-group">
              Genero literario
              <select value={formValues.genre} onChange={(event) => handleFieldChange("genre", event.target.value)}>
                <option value="">Sin genero</option>
                {LITERARY_GENRE_OPTIONS.map((genreOption) => (
                  <option key={genreOption.value} value={genreOption.value}>
                    {genreOption.label}
                  </option>
                ))}
              </select>
            </label>

            <ThemeSelector
              error={errors.themes}
              helperText={`Selecciona hasta ${MAX_BOOK_THEMES} temas principales.`}
              options={themeOptions}
              selectedThemes={formValues.themes}
              onChange={(nextThemes) => handleFieldChange("themes", nextThemes)}
              variant="dropdowns"
            />

            <label className="field-group">
              Coleccion
              <input
                value={formValues.collection}
                onChange={(event) => handleFieldChange("collection", event.target.value)}
              />
            </label>

            <label className="field-group">
              URL de portada
              <input
                value={formValues.coverUrl}
                onChange={(event) => handleFieldChange("coverUrl", event.target.value)}
              />
              {errors.coverUrl ? <p className="field-error">{errors.coverUrl}</p> : null}
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
