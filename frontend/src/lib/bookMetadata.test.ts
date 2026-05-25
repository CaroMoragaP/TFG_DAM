import { describe, expect, it } from "vitest";

import { validateSharedBookFields } from "./bookMetadata";

describe("validateSharedBookFields", () => {
  it("returns the shared validation errors used by create and edit forms", () => {
    expect(
      validateSharedBookFields({
        title: "   ",
        authorFirstName: "",
        authorLastName: "",
        publicationYear: "10000",
        coverUrl: "notaurl",
        themes: ["Uno", "Dos", "Tres", "Cuatro"],
      }),
    ).toEqual({
      title: "El título es obligatorio.",
      authorFirstName: "El autor es obligatorio.",
      publicationYear: "Introduce un año válido.",
      coverUrl: "Introduce una URL válida.",
      themes: "Selecciona como máximo 3 temas.",
    });
  });
});
