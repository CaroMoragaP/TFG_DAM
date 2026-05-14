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
      title: "El titulo es obligatorio.",
      authorFirstName: "El autor es obligatorio.",
      publicationYear: "Introduce un ano valido.",
      coverUrl: "Introduce una URL valida.",
      themes: "Selecciona como maximo 3 temas.",
    });
  });
});
