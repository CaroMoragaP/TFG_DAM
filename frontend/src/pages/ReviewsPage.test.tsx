import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ReviewsPage } from "./ReviewsPage";

describe("ReviewsPage", () => {
  it("redirects legacy review routes to the wall opinions tab", async () => {
    render(
      <MemoryRouter initialEntries={["/resenas"]}>
        <Routes>
          <Route path="/resenas" element={<ReviewsPage />} />
          <Route path="/muro" element={<p>Pantalla muro</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Pantalla muro")).toBeInTheDocument();
  });
});
