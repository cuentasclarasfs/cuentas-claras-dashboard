"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { sql, STATUS, CLOSERS } from "@/lib/db";
import { escribirEnHoja } from "@/lib/hojaVentas";

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return s ? Number(s) : null;
}

export async function guardarReunion(form: FormData) {
  const user = await currentUser();
  const mail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!mail) throw new Error("Sin sesión");

  const id = String(form.get("id"));
  const status = String(form.get("status") ?? "");
  if (!STATUS.includes(status)) throw new Error("Status inválido");

  // Un closer solo puede completar sus reuniones; el resto del equipo (setter, admin) cualquiera.
  if (CLOSERS[mail] && user?.publicMetadata?.role !== "admin") {
    const [r] = (await sql`SELECT closer_mail FROM reuniones WHERE id=${id}`) as { closer_mail: string }[];
    if (r?.closer_mail !== mail) throw new Error("Esta reunión es de otro closer");
  }

  const datos = {
    status, metodo_pago: String(form.get("metodo_pago") ?? "") || null, monto_24h: num(form.get("monto_24h")),
    aov: num(form.get("aov")), comentario: String(form.get("comentario") ?? "") || null,
  };
  // Primero el Sheets (manda mientras el equipo lo use): si falla, no se guarda nada y el closer ve el error.
  const [r] = (await sql`SELECT nombre, fecha_reu FROM reuniones WHERE id=${id}`) as { nombre: string; fecha_reu: string }[];
  await escribirEnHoja({ ...r, ...datos });
  await sql`UPDATE reuniones SET status=${datos.status}, metodo_pago=${datos.metodo_pago}, monto_24h=${datos.monto_24h},
      aov=${datos.aov}, comentario=${datos.comentario}, completado_por=${mail}, completado_en=now()
    WHERE id=${id}`;
  revalidatePath("/dashboard/reuniones");
}
