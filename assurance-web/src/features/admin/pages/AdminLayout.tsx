import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdminAccess } from "./admin-access";

export default function AdminLayout() {
  const { pathname } = useLocation();
  const access = useAdminAccess();
  const section = access.sections.find((item) => pathname === `/app/admin/${item.key}` || pathname.startsWith(`/app/admin/${item.key}/`));

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">
          {access.isPlatformMode ? "Administration de la plateforme" : "Administration d’agence"}
        </p>
        <h1 className="text-2xl font-semibold">{section?.title ?? "Administration"}</h1>
        <p className="text-sm text-muted-foreground">{section?.description ?? "Gérez les accès et les paramètres de votre périmètre."}</p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b" aria-label="Navigation administration">
        {access.sections.map((item) => (
          <NavLink
            key={item.key}
            to={`/app/admin/${item.key}`}
            className={({ isActive }) => `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? "border-fuchsia-700 text-fuchsia-700 dark:border-fuchsia-400 dark:text-fuchsia-300" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
