import { NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { to: "/app", label: "Resumen" },
  { to: "/app/library", label: "Estanteria" },
  { to: "/login", label: "Cerrar sesion" },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Biblioteca compartida</p>
          <h1>Espacio privado</h1>
        </div>
        <span className="status-pill">Setup fase 0</span>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <div className="sidebar-card">
            <p className="sidebar-title">Navegacion</p>
            <nav className="sidebar-nav" aria-label="Navegacion principal">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                  end={item.to === "/app"}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

