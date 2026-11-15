// Leads del diagnóstico de la web (cuentasclarasfs.com/diagnostico), los mismos que ve el setter en /equipo.
export type LeadDiag = { fecha: string; mail: string; wa: string; nivel: string; sintomas: number; factura: boolean; objetivo: string };

// "+54 9 11 7282-9255" y "5491172829255" → "1172829255": así cruzan el teléfono de Calendly y el del diagnóstico.
export const telCorto = (t: string | null) => {
  let d = (t ?? "").replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3); else if (d.startsWith("54")) d = d.slice(2);
  return d.length >= 8 ? d.slice(-10) : "";
};

export async function leadsDiagnostico() {
  try {
    // shortcut: la web devuelve los últimos 500 leads; alcanza para las reuniones de estas semanas, no para el histórico.
    const r = await fetch("https://cuentasclarasfs.com/wp-json/cc/v1/leads", {
      headers: { "x-clave": process.env.CC_CLAVE_EQUIPO ?? "", "User-Agent": "cc-crm" },
      next: { revalidate: 300 },
    });
    const leads: LeadDiag[] = r.ok ? (await r.json()).leads ?? [] : [];
    const porMail = new Map<string, LeadDiag>(), porTel = new Map<string, LeadDiag>();
    for (const l of leads.slice().reverse()) { // el más reciente pisa al viejo
      if (l.mail) porMail.set(l.mail.toLowerCase().trim(), l);
      if (telCorto(l.wa)) porTel.set(telCorto(l.wa), l);
    }
    const desde = leads.length ? new Date(leads[leads.length - 1].fecha).getTime() : Infinity;
    return {
      buscar: (mail: string | null, tel: string | null) =>
        porMail.get((mail ?? "").toLowerCase().trim()) ?? porTel.get(telCorto(tel)) ?? null,
      desde, // antes de esta fecha no hay datos: no se puede decir «no lo hizo»
    };
  } catch {
    return { buscar: () => null, desde: Infinity }; // si la web no responde, la pantalla anda igual
  }
}
