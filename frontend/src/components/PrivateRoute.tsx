import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="route-loader">
        <section className="panel centered-panel">
          <p className="eyebrow">Sesión</p>
          <h1>Recuperando acceso</h1>
          <p>Validando tu token antes de entrar en la biblioteca privada.</p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
