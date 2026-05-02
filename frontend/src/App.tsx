import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { PrivateRoute } from "./components/PrivateRoute";
import { PrivateLayout } from "./layouts/PrivateLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { AuthPage } from "./pages/AuthPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LibrariesPage } from "./pages/LibrariesPage";
import { ListDetailPage } from "./pages/ListDetailPage";
import { LibrarySectionPage } from "./pages/LibrarySectionPage";
import { ListsPage } from "./pages/ListsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicHomePage } from "./pages/PublicHomePage";
import { ReadingPage } from "./pages/ReadingPage";
import { StatsPage } from "./pages/StatsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <PublicHomePage />,
      },
      {
        path: "auth",
        element: <AuthPage />,
      },
      {
        path: "login",
        element: <Navigate to="/auth" replace />,
      },
      {
        path: "register",
        element: <Navigate to="/auth?tab=register" replace />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <PrivateLayout />
      </PrivateRoute>
    ),
    children: [
      {
        path: "catalogo",
        element: <DashboardPage />,
      },
      {
        path: "libros/:id",
        element: <BookDetailPage />,
      },
      {
        path: "lectura",
        element: <ReadingPage />,
      },
      {
        path: "leyendo",
        element: <Navigate to="/lectura?tab=reading" replace />,
      },
      {
        path: "leidos",
        element: <Navigate to="/lectura?tab=finished" replace />,
      },
      {
        path: "pendiente",
        element: <Navigate to="/lectura?tab=pending" replace />,
      },
      {
        path: "resenas",
        element: (
          <LibrarySectionPage
            eyebrow="Comunidad"
            title="Resenas"
            description="Aqui se integraran las resenas, comentarios y valoraciones de la biblioteca."
          />
        ),
      },
      {
        path: "listas",
        element: <ListsPage />,
      },
      {
        path: "listas/:id",
        element: <ListDetailPage />,
      },
      {
        path: "bibliotecas",
        element: <LibrariesPage />,
      },
      {
        path: "stats",
        element: <StatsPage />,
      },
    ],
  },
  {
    path: "/app/*",
    element: <Navigate to="/catalogo" replace />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
