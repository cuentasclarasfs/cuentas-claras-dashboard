"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { sql, STATUS, CLOSERS } from "@/lib/db";
import { escribirEnHoja, reagendarEnHoja } from "@/lib/hojaVentas";

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return s ? Number(s) : null;
}

// Un closer solo puede tocar sus reuniones; el resto del equipo (setter, admin) cualquiera.
async function permiso(id: string) {
  const user = await currentUser();
  const mail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!mail) throw new Error("Sin sesión");
  if (CLOSERS[mail] && user?.publicMetadata?.role !== "admin") {
    const [r] = (await sql`SELECT closer_mail FROM reuniones WHERE id=${id}`) as { closer_mail: string }[];
    if (r?.closer_mail !== mail) throw new Error("Esta reunión es de otro closer");
  }
  return mail;
}

export async function guardarReunion(form: FormData) {
  const id = String(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!STATUS.includes(status)) throw new Error("Status inválido");
  const mail = await permiso(id);

  const datos = {
    status, metodo_pago: String(form.get("metodo_pago") ?? "") || null, monto_24h: num(form.get("monto_24h")),
    aov: num(form.get("aov")), comentario: String(form.get("comentario") ?? "") || null,
  };
  if (status === "Cliente confirmado" && !datos.aov) throw new Error("Para Cliente confirmado falta el monto del trato (AOV).");
  // Primero el Sheets (manda mientras el equipo lo use): si falla, no se guarda nada y el closer ve el error.
  const [r] = (await sql`SELECT nombre, fecha_reu FROM reuniones WHERE id=${id}`) as { nombre: string; fecha_reu: string }[];
  if (!(await escribirEnHoja({ ...r, ...datos }))) throw new Error("No encontré la fila de esta reunión en el Sheets: avisale a Busta.");
  await sql`UPDATE reuniones SET status=${datos.status}, metodo_pago=${datos.metodo_pago}, monto_24h=${datos.monto_24h},
      aov=${datos.aov}, comentario=${datos.comentario}, completado_por=${mail}, completado_en=now()
    WHERE id=${id}`;
  revalidatePath("/dashboard/reuniones");
}

/** El closer cambia la fecha a mano (reagendó por WhatsApp): va al Sheets (columna N) y a la plataforma, y Calendly ya no la pisa. */
export async function reagendarReunion(form: FormData) {
  const id = String(form.get("id"));
  const nueva = new Date(`${form.get("fecha")}:00-03:00`); // lo que elige el closer es hora de Argentina
  if (isNaN(nueva.getTime())) throw new Error("Fecha inválida");
  await permiso(id);
  const [r] = (await sql`SELECT nombre, fecha_reu FROM reuniones WHERE id=${id}`) as { nombre: string; fecha_reu: string }[];
  if (!(await reagendarEnHoja(r, nueva))) throw new Error("No encontré la fila de esta reunión en el Sheets: avisale a Busta.");
  await sql`UPDATE reuniones SET fecha_reu=${nueva.toISOString()}, fecha_manual=true WHERE id=${id}`;
  revalidatePath("/dashboard/reuniones");
}
