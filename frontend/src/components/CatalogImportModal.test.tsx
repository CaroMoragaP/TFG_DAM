import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogImportModal } from "./CatalogImportModal";
import type { Library } from "../lib/api";

const libraries: Library[] = [
  {
    id: 1,
    name: "Biblioteca personal",
    type: "personal",
    created_at: "2026-04-19T00:00:00Z",
    role: "owner",
    is_archived: false,
    archived_at: null,
    member_count: 1,
    copy_count: 1,
  },
];

describe("CatalogImportModal", () => {
  it("starts without a preselected destination library", () => {
    render(
      <CatalogImportModal
        defaultLibraryId={null}
        errorMessage={null}
        isImporting={false}
        isOpen={true}
        isPreviewing={false}
        libraries={libraries}
        preview={null}
        onClose={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onPreview={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect((screen.getByLabelText("Biblioteca destino") as HTMLSelectElement).value).toBe("");
  });

  it("requires choosing a library before previewing the import", async () => {
    const onPreview = vi.fn().mockResolvedValue(undefined);

    render(
      <CatalogImportModal
        defaultLibraryId={null}
        errorMessage={null}
        isImporting={false}
        isOpen={true}
        isPreviewing={false}
        libraries={libraries}
        preview={null}
        onClose={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onPreview={onPreview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previsualizar importacion" }));

    await waitFor(() => {
      expect(screen.getByText("Selecciona una biblioteca valida.")).toBeInTheDocument();
    });
    expect(onPreview).not.toHaveBeenCalled();
  });
});
