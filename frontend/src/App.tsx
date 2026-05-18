import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { PrivateRoute } from "./components/PrivateRoute";
import { PrivateLayout } from "./layouts/PrivateLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { ActivityPage } from "./pages/ActivityPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LibrariesPage } from "./pages/LibrariesPage";
import { ListDetailPage } from "./pages/ListDetailPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicHomePage } from "./pages/PublicHomePage";
import { ReadingPage } from "./pages/ReadingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { StatsPage } from "./pages/StatsPage";

function LegacyAuthRedirect() {
  const [searchParams] = useSearchParams();
  const targetPath = searchParams.get("tab") === "register" ? "/register" : "/login";

  return <Navigate to={targetPath} replace />;
}

function LegacyBookDetailRedirect() {
  const { id } = useParams();

  return <Navigate to={id ? `/ejemplar/${id}` : "/catalogo"} replace />;
}

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
        element: <LegacyAuthRedirect />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
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
        path: "ejemplar/:copyId",
        element: <BookDetailPage />,
      },
      {
        path: "libros/:id",
        element: <LegacyBookDetailRedirect />,
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
        element: <ReviewsPage />,
      },
      {
        path: "muro",
        element: <ActivityPage />,
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
