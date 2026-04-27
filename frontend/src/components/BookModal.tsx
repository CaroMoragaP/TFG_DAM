import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  ApiError,
  fetchOpenLibraryBook,
  type Book,
  type ExternalBookLookup,
  type Library,
  type ReadingStatus,
} from "../lib/api";

export type BookFormValues = {
  libraryId: string;
  title: string;
  author: string;
  authorCountry: string;
  publicationYear: string;
  isbn: string;
  genre: string;
  collection: string;
  readingStatus: ReadingStatus;
  coverUrl: string;
  userRating: string;
};

type BookModalProps = {
  book: Book | null;
  defaultLibraryId: number | null;
  genres: string[];
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
  author: "",
  authorCountry: "",
  publicationYear: "",
  isbn: "",
  genre: "",
  collection: "",
  readingStatus: "pending",
  coverUrl: "",
  userRating: "",
});

function bookToFormValues(book: Book): BookFormValues {
  return {
    libraryId: String(book.library_id),
    title: book.title,
    author: book.authors[0] ?? "",
    authorCountry: book.author_country ?? "",
    publicationYear: book.publication_year ? String(book.publication_year) : "",
    isbn: book.isbn ?? "",
    genre: book.genres[0] ?? "",
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
  const errors: FormErrors = {};

  if (mode === "create") {
    const parsedLibraryId = Number(values.libraryId);
    if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
      errors.libraryId = "Selecciona una biblioteca.";
    }
  }

  if (!values.title.trim()) {
    errors.title = "El titulo es obligatorio.";
  }

  if (!values.author.trim()) {
    errors.author = "El autor es obligatorio.";
  }

  if (values.publicationYear.trim()) {
    const parsedYear = Number(values.publicationYear);
    if (!Number.isInteger(parsedYear) || parsedYear < 0 || parsedYear > 9999) {
      errors.publicationYear = "Introduce un ano valido.";
    }
  }

  if (values.coverUrl.trim()) {
    try {
      new URL(values.coverUrl);
    } catch {
      errors.coverUrl = "Introduce una URL valida.";
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
    author: importedBook.authors[0] ?? "",
    publicationYear: importedBook.publication_year ? String(importedBook.publication_year) : "",
    isbn: importedBook.isbn ?? "",
    genre: importedBook.genres[0] ?? "",
    coverUrl: importedBook.cover_url ?? "",
  };
}

export function BookModal({
  book,
  defaultLibraryId,
  genres,
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

      if (!isbn && !title) {
        throw new Error("Escribe un ISBN o un titulo antes de buscar.");
      }

      return fetchOpenLibraryBook(token, isbn ? { isbn } : { q: title });
    },
    onSuccess: (importedBook) => {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.form;
        delete nextErrors.title;
        delete nextErrors.author;
        delete nextErrors.authorCountry;
        delete nextErrors.publicationYear;
        delete nextErrors.isbn;
        delete nextErrors.genre;
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

  const genreOptions =
    !formValues.genre || genres.includes(formValues.genre) ? genres : [formValues.genre, ...genres];

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
            <p className="eyebrow">{mode === "create" ? "Nuevo libro" : "Editar libro"}</p>
            <h2 id="book-modal-title">{mode === "create" ? "Anadir libro" : "Guardar cambios"}</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-grid">
            {mode === "create" ? (
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
              Titulo
              <input value={formValues.title} onChange={(event) => handleFieldChange("title", event.target.value)} />
              {errors.title ? <p className="field-error">{errors.title}</p> : null}
            </label>

            <label className="field-group">
              Autor
              <input value={formValues.author} onChange={(event) => handleFieldChange("author", event.target.value)} />
              {errors.author ? <p className="field-error">{errors.author}</p> : null}
            </label>

            <label className="field-group">
              Pais del autor
              <input
                value={formValues.authorCountry}
                onChange={(event) => handleFieldChange("authorCountry", event.target.value)}
              />
              {errors.authorCountry ? <p className="field-error">{errors.authorCountry}</p> : null}
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
              Genero
              <select value={formValues.genre} onChange={(event) => handleFieldChange("genre", event.target.value)}>
                <option value="">Sin genero</option>
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
              {errors.genre ? <p className="field-error">{errors.genre}</p> : null}
            </label>

            <label className="field-group">
              Coleccion
              <input
                value={formValues.collection}
                onChange={(event) => handleFieldChange("collection", event.target.value)}
              />
              {errors.collection ? <p className="field-error">{errors.collection}</p> : null}
            </label>

            {mode === "create" ? (
              <label className="field-group">
                Estado inicial
                <select
                  value={formValues.readingStatus}
                  onChange={(event) => handleFieldChange("readingStatus", event.target.value as ReadingStatus)}
                >
                  <option value="pending">Pendiente</option>
                  <option value="reading">Leyendo</option>
                  <option value="finished">Leido</option>
                </select>
              </label>
            ) : null}

            <label className="field-group">
              URL de portada
              <input
                value={formValues.coverUrl}
                onChange={(event) => handleFieldChange("coverUrl", event.target.value)}
              />
              {errors.coverUrl ? <p className="field-error">{errors.coverUrl}</p> : null}
            </label>

            {mode === "create" ? (
              <label className="field-group">
                Rating
                <select
                  value={formValues.userRating}
                  onChange={(event) => handleFieldChange("userRating", event.target.value)}
                >
                  <option value="">Sin rating</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                {errors.userRating ? <p className="field-error">{errors.userRating}</p> : null}
              </label>
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
