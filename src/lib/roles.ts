export type Role = "admin" | "ventas" | "ops";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  ventas: "Equipo de Ventas",
  ops: "Operaciones",
};

export const ROLE_SECTIONS: Record<Role, string[]> = {
  admin:  ["home", "reuniones", "resumen", "finanzas", "clientes", "ventas", "setting", "marketing", "operaciones", "administracion", "patrimonio", "contenido"],
  ventas: ["reuniones", "ventas", "setting", "marketing", "contenido", "administracion"],
  ops:    ["clientes", "administracion"],
};

export function canAccess(role: Role, section: string): boolean {
  if (section === "home") return role === "admin";
  return ROLE_SECTIONS[role]?.includes(section) ?? false;
}

export function getDefaultSection(role: Role): string {
  if (role === "admin") return "home";
  if (role === "ventas") return "reuniones";
  return "clientes";
}
