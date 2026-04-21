import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { PrivateRoute } from "./components/PrivateRoute";
import { PrivateLayout } from "./layouts/PrivateLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { AuthPage } from "./pages/AuthPage";
import { LibrarySectionPage } from "./pages/LibrarySectionPage";
import { ListsPage } from "./pages/ListsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicHomePage } from "./pages/PublicHomePage";

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
        path: "leyendo",
        element: (
          <LibrarySectionPage
            eyebrow="Seguimiento"
            title="Leyendo"
            description="Espacio reservado para la lista activa de lecturas en curso y sus avances."
          />
        ),
      },
      {
        path: "leidos",
        element: (
          <LibrarySectionPage
            eyebrow="Historial"
            title="Leídos"
            description="Aquí vivirá el archivo de libros terminados con filtros y notas personales."
          />
        ),
      },
      {
        path: "pendiente",
        element: (
          <LibrarySectionPage
            eyebrow="Planificación"
            title="Pendiente"
            description="Pantalla placeholder para la pila de próximas lecturas y prioridades."
          />
        ),
      },
      {
        path: "resenas",
        element: (
          <LibrarySectionPage
            eyebrow="Comunidad"
            title="Reseñas"
            description="Aquí se integrarán las reseñas, comentarios y valoraciones de la biblioteca."
          />
        ),
      },
      {
        path: "listas",
        element: <ListsPage />,
      },
      {
        path: "stats",
        element: (
          <LibrarySectionPage
            eyebrow="Analítica"
            title="Stats"
            description="Módulo inicial para futuras métricas de lectura, actividad y progreso."
          />
        ),
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
  return <RouterProvider router={router} />;
}
