import { NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { to: "/app", label: "Resumen" },
  { to: "/app/library", label: "Estantería" },
  { to: "/login", label: "Cerrar sesión" },
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
            <p className="sidebar-title">Navegación</p>
            <nav className="sidebar-nav" aria-label="Navegación principal">
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
