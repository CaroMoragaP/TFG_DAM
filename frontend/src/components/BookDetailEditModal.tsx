import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  ApiError,
  fetchOpenLibraryBook,
  type AuthorSex,
  type BookMetadata,
  type CopyDetail,
  type CopyFormat,
  type ExternalBookLookup,
  type Library,
} from "../lib/api";
import {
  MAX_BOOK_THEMES,
  type LiteraryGenreOption,
  normalizeThemeSelection,
  validateSharedBookFields,
} from "../lib/bookMetadata";
import type { BookMetadataValues } from "./BookMetadataModal";
import type { CopyEditValues } from "./CopyEditModal";
import { ThemeSelector } from "./ThemeSelector";

export type BookDetailEditValues = {
  book: BookMetadataValues;
  copy: CopyEditValues;
};

type BookDetailEditModalProps = {
  book: BookMetadata | null;
  copy: CopyDetail | null;
  library?: Library | null;
  canEditBook: boolean;
  canEditCopy: boolean;
  isOpen: boolean;
  isSaving: boolean;
  genreOptions: LiteraryGenreOption[];
  themeOptions: string[];
  token: string;
  onClose: () => void;
  onSubmit: (values: BookDetailEditValues) => Promise<void>;
};

type FormErrors = Partial<Record<keyof BookMetadataValues | keyof CopyEditValues | "form", string>>;

function emptyBookValues(): BookMetadataValues {
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

function toBookFormValues(book: BookMetadata): BookMetadataValues {
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

function emptyCopyValues(): CopyEditValues {
  return {
    format: "physical",
    status: "available",
    physicalLocation: "",
    digitalLocation: "",
  };
}

function toCopyFormValues(copy: CopyDetail): CopyEditValues {
  return {
    format: copy.format,
    status: copy.status,
    physicalLocation: copy.physical_location ?? "",
    digitalLocation: copy.digital_location ?? "",
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

export function BookDetailEditModal({
  book,
  copy,
  library,
  canEditBook,
  canEditCopy,
  isOpen,
  isSaving,
  genreOptions,
  themeOptions,
  token,
  onClose,
  onSubmit,
}: BookDetailEditModalProps) {
  const [bookValues, setBookValues] = useState<BookMetadataValues>(emptyBookValues());
  const [copyValues, setCopyValues] = useState<CopyEditValues>(emptyCopyValues());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!isOpen || !copy) {
      return;
    }

    setErrors({});
    setCopyValues(toCopyFormValues(copy));
    setBookValues(book ? toBookFormValues(book) : emptyBookValues());
  }, [book, copy, isOpen]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const isbn = bookValues.isbn.trim();
      const title = bookValues.title.trim();
      const author = buildAuthorDisplayName(bookValues.authorFirstName, bookValues.authorLastName);
      const publisher = bookValues.publisherName.trim();

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
      setBookValues((currentValues) => applyImportedBook(currentValues, importedBook));
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

  if (!isOpen || !copy || (!canEditBook && !canEditCopy)) {
    return null;
  }

  function clearErrors(field: keyof FormErrors) {
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

  function handleBookFieldChange<Field extends keyof BookMetadataValues>(
    field: Field,
    value: BookMetadataValues[Field],
  ) {
    setBookValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    clearErrors(field);
  }

  function handleCopyFieldChange<Field extends keyof CopyEditValues>(field: Field, value: CopyEditValues[Field]) {
    setCopyValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    clearErrors(field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (canEditBook) {
      Object.assign(
        nextErrors,
        validateSharedBookFields({
          title: bookValues.title,
          authorFirstName: bookValues.authorFirstName,
          authorLastName: bookValues.authorLastName,
          publicationYear: bookValues.publicationYear,
          coverUrl: bookValues.coverUrl,
          themes: bookValues.themes,
        }),
      );
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        book: bookValues,
        copy: copyValues,
      });
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "No se pudieron guardar los cambios.",
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-detail-edit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Edicion del ejemplar</p>
            <h2 id="book-detail-edit-modal-title">Editar</h2>
            <p className="detail-inline-copy modal-subtitle">{copy.title}</p>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="content-stack">
            {canEditCopy ? (
              <section className="content-stack">
                <div>
                  <p className="eyebrow">Ejemplar local</p>
                  <p className="detail-inline-copy">{library?.name ?? "Biblioteca"}</p>
                </div>

                <div className="modal-grid">
                  <div className="field-group">
                    Biblioteca
                    <div className="readonly-field">{library?.name ?? "Biblioteca"}</div>
                  </div>

                  <label className="field-group">
                    Formato
                    <select
                      value={copyValues.format}
                      onChange={(event) => handleCopyFieldChange("format", event.target.value as CopyFormat)}
                    >
                      <option value="physical">Fisico</option>
                      <option value="digital">Digital</option>
                    </select>
                  </label>

                  <label className="field-group">
                    Ubicacion fisica
                    <input
                      value={copyValues.physicalLocation}
                      onChange={(event) => handleCopyFieldChange("physicalLocation", event.target.value)}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {canEditBook ? (
              <section className="content-stack">
                <div>
                  <p className="eyebrow">Ficha canonica</p>
                  <p className="detail-inline-copy">Busca por ISBN o por titulo, nombre y editorial.</p>
                </div>

                <div className="modal-grid">
                  <label className="field-group">
                    ISBN
                    <div className="compound-field">
                      <input
                        value={bookValues.isbn}
                        onChange={(event) => handleBookFieldChange("isbn", event.target.value)}
                      />
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
                    <input
                      value={bookValues.title}
                      onChange={(event) => handleBookFieldChange("title", event.target.value)}
                    />
                    {errors.title ? <p className="field-error">{errors.title}</p> : null}
                  </label>

                  <label className="field-group">
                    Editorial
                    <input
                      value={bookValues.publisherName}
                      onChange={(event) => handleBookFieldChange("publisherName", event.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    Nombre del autor
                    <input
                      value={bookValues.authorFirstName}
                      onChange={(event) => handleBookFieldChange("authorFirstName", event.target.value)}
                    />
                    {errors.authorFirstName ? <p className="field-error">{errors.authorFirstName}</p> : null}
                  </label>

                  <label className="field-group">
                    Apellido del autor
                    <input
                      value={bookValues.authorLastName}
                      onChange={(event) => handleBookFieldChange("authorLastName", event.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    Sexo del autor principal
                    <select
                      value={bookValues.authorSex}
                      onChange={(event) => handleBookFieldChange("authorSex", event.target.value as AuthorSex | "")}
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
                      value={bookValues.authorCountry}
                      onChange={(event) => handleBookFieldChange("authorCountry", event.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    Ano
                    <input
                      inputMode="numeric"
                      value={bookValues.publicationYear}
                      onChange={(event) => handleBookFieldChange("publicationYear", event.target.value)}
                    />
                    {errors.publicationYear ? <p className="field-error">{errors.publicationYear}</p> : null}
                  </label>

                  <label className="field-group">
                    Genero literario
                    <select
                      value={bookValues.genre}
                      onChange={(event) => handleBookFieldChange("genre", event.target.value)}
                    >
                      <option value="">Sin genero</option>
                      {genreOptions.map((genreOption) => (
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
                    selectedThemes={bookValues.themes}
                    onChange={(nextThemes) => handleBookFieldChange("themes", nextThemes)}
                    variant="dropdowns"
                  />

                  <label className="field-group">
                    Coleccion
                    <input
                      value={bookValues.collection}
                      onChange={(event) => handleBookFieldChange("collection", event.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    URL de portada
                    <input
                      value={bookValues.coverUrl}
                      onChange={(event) => handleBookFieldChange("coverUrl", event.target.value)}
                    />
                    {errors.coverUrl ? <p className="field-error">{errors.coverUrl}</p> : null}
                  </label>

                  <label className="field-group field-span-full">
                    Descripcion
                    <textarea
                      className="notes-textarea"
                      rows={4}
                      value={bookValues.description}
                      onChange={(event) => handleBookFieldChange("description", event.target.value)}
                    />
                  </label>
                </div>
              </section>
            ) : null}
          </div>

          {errors.form ? <p className="form-error">{errors.form}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
