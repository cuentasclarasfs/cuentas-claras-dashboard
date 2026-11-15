// Trae TODAS las agendas de Calendly (desde jul-2024) a la base. Uso: npx tsx --env-file=.env.local scripts/historico-calendly.ts
import { syncCalendly } from "../src/lib/calendly";
(async () => {
  for (let d = new Date("2024-10-01"); d < new Date("2027-03-01"); d.setMonth(d.getMonth() + 1)) {
    const fin = new Date(d); fin.setMonth(fin.getMonth() + 1);
    const r = await syncCalendly(new Date(d), fin);
    console.log(d.toISOString().slice(0, 7), r);
  }
})();
