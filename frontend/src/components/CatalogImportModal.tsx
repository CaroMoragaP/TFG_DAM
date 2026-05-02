import { useEffect, useMemo, useState } from "react";

import type { CatalogImportPreview, CatalogImportPreviewRow, Library } from "../lib/api";

type CatalogImportModalProps = {
  defaultLibraryId: number | null;
  errorMessage: string | null;
  isImporting: boolean;
  isOpen: boolean;
  isPreviewing: boolean;
  libraries: Library[];
  preview: CatalogImportPreview | null;
  onClose: () => void;
  onConfirm: (libraryId: number, rows: CatalogImportPreviewRow[]) => Promise<void>;
  onPreview: (libraryId: number, file: File) => Promise<void>;
};

export function CatalogImportModal({
  defaultLibraryId,
  errorMessage,
  isImporting,
  isOpen,
  isPreviewing,
  libraries,
  preview,
  onClose,
  onConfirm,
  onPreview,
}: CatalogImportModalProps) {
  const [libraryId, setLibraryId] = useState(defaultLibraryId ? String(defaultLibraryId) : "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLibraryId(defaultLibraryId ? String(defaultLibraryId) : "");
    setSelectedFile(null);
    setLocalError(null);
  }, [defaultLibraryId, isOpen]);

  const readyRows = useMemo(
    () => preview?.rows.filter((row) => row.status === "ready") ?? [],
    [preview],
  );

  if (!isOpen) {
    return null;
  }

  async function handlePreview() {
    const parsedLibraryId = Number(libraryId);
    if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
      setLocalError("Selecciona una biblioteca valida.");
      return;
    }
    if (!selectedFile) {
      setLocalError("Selecciona un archivo CSV.");
      return;
    }

    setLocalError(null);
    await onPreview(parsedLibraryId, selectedFile);
  }

  async function handleConfirm() {
    const parsedLibraryId = Number(libraryId);
    if (!Number.isInteger(parsedLibraryId) || parsedLibraryId <= 0) {
      setLocalError("Selecciona una biblioteca valida.");
      return;
    }

    setLocalError(null);
    await onConfirm(parsedLibraryId, readyRows);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-import-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Catalogo</p>
            <h2 id="catalog-import-modal-title">Importar CSV</h2>
          </div>
          <button className="ghost-link compact-action" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="content-stack">
          <label className="field-group">
            Biblioteca destino
            <select value={libraryId} onChange={(event) => setLibraryId(event.target.value)}>
              <option value="">Selecciona una biblioteca</option>
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            Archivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="inline-actions">
            <button className="submit-button compact-button" type="button" onClick={handlePreview} disabled={isPreviewing}>
              {isPreviewing ? "Analizando..." : "Previsualizar importacion"}
            </button>
            {preview && readyRows.length > 0 ? (
              <button className="ghost-link compact-action" type="button" onClick={handleConfirm} disabled={isImporting}>
                {isImporting ? "Importando..." : `Importar ${readyRows.length} filas`}
              </button>
            ) : null}
          </div>

          {localError || errorMessage ? <p className="form-error">{localError ?? errorMessage}</p> : null}

          {preview ? (
            <div className="content-stack">
              <div className="panel subtle-panel">
                <p>Total: {preview.total}</p>
                <p>Listas: {preview.ready}</p>
                <p>Duplicadas: {preview.duplicates}</p>
                <p>Invalidas: {preview.invalid}</p>
              </div>

              <div className="content-stack" style={{ maxHeight: "18rem", overflowY: "auto" }}>
                {preview.rows.map((row) => (
                  <div key={row.row_number} className="panel subtle-panel">
                    <p>
                      Fila {row.row_number}: {row.status}
                    </p>
                    {row.normalized_payload ? <p>{row.normalized_payload.title}</p> : null}
                    {row.normalized_payload?.primary_author_display_name ? (
                      <p>{row.normalized_payload.primary_author_display_name}</p>
                    ) : null}
                    {row.messages.map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
