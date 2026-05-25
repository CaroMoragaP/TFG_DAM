import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  ApiError,
  type AuthorSex,
  fetchOpenLibraryBook,
  type Book,
  type ExternalBookLookup,
  type Library,
  type ReadingStatus,
} from "../lib/api";
import {
  MAX_BOOK_THEMES,
  type LiteraryGenreOption,
  normalizeThemeSelection,
  validateSharedBookFields,
} from "../lib/bookMetadata";
import { ThemeSelector } from "./ThemeSelector";

export type BookFormValues = {
  libraryId: string;
  title: string;
  authorFirstName: string;
  authorLastName: string;
  authorSex: AuthorSex | "";
  authorCountry: string;
  publicationYear: string;
  isbn: string;
  publisherName: string;
  genre: string;
  themes: string[];
  collection: string;
  readingStatus: ReadingStatus;
  coverUrl: string;
  userRating: string;
};

type BookModalProps = {
  book: Book | null;
  defaultLibraryId: number | null;
  genreOptions: LiteraryGenreOption[];
  themeOptions: string[];
  isOpen: boolean;
  isSaving: boolean;
  libraries: Library[];
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (values: BookFormValues) => Promise<void>;
  token: string;
};

type FormErrors = Partial<Record<keyof BookFormValues | "form", string>>;

const emptyFormValues = (defaultLibraryId: number | null): BookFormValues => ({
  libraryId: defaultLibraryId ? String(defaultLibraryId) : "",
  title: "",
  authorFirstName: "",
  authorLastName: "",
  authorSex: "",
  authorCountry: "",
  publicationYear: "",
  isbn: "",
  publisherName: "",
  genre: "",
  themes: [],
  collection: "",
  readingStatus: "pending",
  coverUrl: "",
  userRating: "",
});

function bookToFormValues(book: Book): BookFormValues {
  return {
    libraryId: String(book.library_id),
    title: book.title,
    authorFirstName: book.primary_author?.first_name ?? book.primary_author?.display_name ?? "",
    authorLastName: book.primary_author?.last_name ?? "",
    authorSex: book.author_sex ?? "",
    authorCountry: book.author_country ?? "",
    publicationYear: book.publication_year ? String(book.publication_year) : "",
    isbn: book.isbn ?? "",
    publisherName: book.publisher ?? "",
    genre: book.genre ?? "",
    themes: normalizeThemeSelection(book.themes),
    collection: book.collection ?? "",
    readingStatus: book.reading_status,
    coverUrl: book.cover_url ?? "",
    userRating: book.user_rating ? String(book.user_rating) : "",
  };
}

function buildValidationErrors(
  values: BookFormValues,
  mode: "create" | "edit",
): FormErrors {
  const errors: FormErrors = {
    ...validateSharedBookFields({
      title: values.title,
      authorFirstName: values.authorFirstName,
      authorLastName: values.authorLastName,
      publicationYear: values.publicationYear,
      coverUrl: values.coverUrl,
      themes: values.themes,
    }),
  };

  if (mode === "create") {
    const parsedLibraryId = Number(values.libraryId);
    if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
      errors.libraryId = "Selecciona una biblioteca.";
    }
  }

  if (values.userRating.trim()) {
    const parsedRating = Number(values.userRating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      errors.userRating = "El rating debe estar entre 1 y 5.";
    }
  }

  return errors;
}

function applyImportedBook(
  values: BookFormValues,
  importedBook: ExternalBookLookup,
): BookFormValues {
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

function buildAuthorDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function BookModal({
  book,
  defaultLibraryId,
  genreOptions,
  themeOptions,
  isOpen,
  isSaving,
  libraries,
  mode,
  onClose,
  onSubmit,
  token,
}: BookModalProps) {
  const [formValues, setFormValues] = useState<BookFormValues>(emptyFormValues(defaultLibraryId));
  const [errors, setErrors] = useState<FormErrors>({});
  const isCreateMode = mode === "create";
  const selectedRating = formValues.userRating ? Number(formValues.userRating) : 0;
  const currentLibrary =
    libraries.find((library) =>
      mode === "edit" && book ? library.id === book.library_id : library.id === defaultLibraryId,
    ) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErrors({});
    setFormValues(book ? bookToFormValues(book) : emptyFormValues(defaultLibraryId));
  }, [book, defaultLibraryId, isOpen]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const isbn = formValues.isbn.trim();
      const title = formValues.title.trim();
      const author = buildAuthorDisplayName(formValues.authorFirstName, formValues.authorLastName);
      const publisher = formValues.publisherName.trim();

      if (!isbn && !title) {
        throw new Error("Escribe un ISBN o un título antes de buscar.");
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
        delete nextErrors.publisherName;
        delete nextErrors.genre;
        delete nextErrors.themes;
        delete nextErrors.collection;
        delete nextErrors.coverUrl;
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

  if (!isOpen) {
    return null;
  }

  function handleFieldChange<Field extends keyof BookFormValues>(
    field: Field,
    value: BookFormValues[Field],
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

    const nextErrors = buildValidationErrors(formValues, mode);
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
            : "No se pudo guardar el libro.",
      });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{isCreateMode ? "Nuevo libro" : "Editar libro"}</p>
            <h2 id="book-modal-title">{isCreateMode ? "Añadir libro" : "Guardar cambios"}</h2>
            {isCreateMode ? (
              <p className="detail-inline-copy modal-subtitle">
                Busca por ISBN o por título, nombre y editorial.
              </p>
            ) : null}
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            {isCreateMode ? (
              <label className="field-group">
                Biblioteca destino
                <select
                  value={formValues.libraryId}
                  onChange={(event) => handleFieldChange("libraryId", event.target.value)}
                >
                  <option value="">Selecciona una biblioteca</option>
                  {libraries.map((library) => (
                    <option key={library.id} value={library.id}>
                      {library.name}
                    </option>
                  ))}
                </select>
                {errors.libraryId ? <p className="field-error">{errors.libraryId}</p> : null}
              </label>
            ) : null}

            {mode === "edit" && book ? (
              <div className="field-group">
                Biblioteca
                <div className="readonly-field">{currentLibrary?.name ?? "Biblioteca"}</div>
              </div>
            ) : null}

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
              {errors.isbn ? <p className="field-error">{errors.isbn}</p> : null}
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
              {errors.publisherName ? <p className="field-error">{errors.publisherName}</p> : null}
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
              {errors.authorLastName ? <p className="field-error">{errors.authorLastName}</p> : null}
            </label>

            <label className="field-group">
              Sexo del autor
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
              País del autor
              <input
                value={formValues.authorCountry}
                onChange={(event) => handleFieldChange("authorCountry", event.target.value)}
              />
              {errors.authorCountry ? <p className="field-error">{errors.authorCountry}</p> : null}
            </label>

            <label className="field-group">
              Año
              <input
                inputMode="numeric"
                value={formValues.publicationYear}
                onChange={(event) => handleFieldChange("publicationYear", event.target.value)}
              />
              {errors.publicationYear ? <p className="field-error">{errors.publicationYear}</p> : null}
            </label>

            <label className="field-group">
              Género literario
              <select value={formValues.genre} onChange={(event) => handleFieldChange("genre", event.target.value)}>
                <option value="">Sin género</option>
                {genreOptions.map((genreOption) => (
                  <option key={genreOption.value} value={genreOption.value}>
                    {genreOption.label}
                  </option>
                ))}
              </select>
              {errors.genre ? <p className="field-error">{errors.genre}</p> : null}
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
              Colección
              <input
                value={formValues.collection}
                onChange={(event) => handleFieldChange("collection", event.target.value)}
              />
              {errors.collection ? <p className="field-error">{errors.collection}</p> : null}
            </label>

            <label className="field-group">
              URL de portada
              <input
                value={formValues.coverUrl}
                onChange={(event) => handleFieldChange("coverUrl", event.target.value)}
              />
              {errors.coverUrl ? <p className="field-error">{errors.coverUrl}</p> : null}
            </label>

            {isCreateMode ? (
              <div className="field-group field-span-full">
                <span>Rating</span>
                <div className="rating-block">
                  <div className="star-row" role="group" aria-label="Seleccionar rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        className={star <= selectedRating ? "star-button active" : "star-button"}
                        type="button"
                        aria-label={`Puntuar con ${star} estrellas`}
                        aria-pressed={formValues.userRating === String(star)}
                        onClick={() =>
                          handleFieldChange("userRating", formValues.userRating === String(star) ? "" : String(star))
                        }
                      >
                        *
                      </button>
                    ))}
                  </div>
                  <p className="detail-inline-copy">
                    {formValues.userRating ? `${formValues.userRating}/5` : "Sin rating"}
                  </p>
                </div>
                {errors.userRating ? <p className="field-error">{errors.userRating}</p> : null}
              </div>
            ) : null}
          </div>

          {errors.form ? <p className="form-error">{errors.form}</p> : null}

          <div className="modal-actions">
            <button className="ghost-link" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : mode === "create" ? "Guardar libro" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function buildBookPayloadThemes(values: Pick<BookFormValues, "themes">) {
  return normalizeThemeSelection(values.themes);
}
