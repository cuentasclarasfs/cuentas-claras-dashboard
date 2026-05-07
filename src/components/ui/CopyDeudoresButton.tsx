"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Deudor {
  cliente:      string;
  consultor:    string;
  closer:       string;
  responsable:  string;
  dias:         number;
  monto:        number;
}

interface Props {
  deudores:          Deudor[];
  totalDeuda:        number;
  fechaActualizacion: string | null;
}

function fmtARS(n: number): string {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function buildWhatsAppText(deudores: Deudor[], totalDeuda: number, fecha: string | null): string {
  const lines: string[] = [];

  lines.push("🔴 *DEUDORES — Cuentas Claras*");
  if (fecha) lines.push(`_Actualizado al ${fecha}_`);
  lines.push("");

  for (const d of deudores) {
    const urgency = d.dias > 90 ? "🔴" : d.dias > 30 ? "🟡" : "🟠";
    const montoStr = d.monto > 0 ? fmtARS(d.monto) : "—";
    lines.push(`${urgency} *${d.cliente}*`);
    const detalle = [
      d.consultor    ? `Asesor: ${d.consultor}`         : null,
      d.closer       ? `Closer: ${d.closer}`            : null,
      d.responsable  ? `Responsable: ${d.responsable}`  : null,
    ].filter(Boolean).join(" | ");
    if (detalle) lines.push(`   _${detalle}_`);
    lines.push(`   ⏰ ${d.dias} días atrasado | 💰 ${montoStr}`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push(`💰 *Total adeudado: ${totalDeuda > 0 ? fmtARS(totalDeuda) : "—"}*`);
  lines.push(`📋 _${deudores.length} ${deudores.length === 1 ? "deudor" : "deudores"}_`);

  return lines.join("\n");
}

export function CopyDeudoresButton({ deudores, totalDeuda, fechaActualizacion }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildWhatsAppText(deudores, totalDeuda, fechaActualizacion);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        copied
          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40"
          : "bg-surface-700 hover:bg-surface-600 text-slate-300 hover:text-white border border-surface-600"
      }`}
    >
      {copied ? (
        <>
          <Check size={14} />
          ¡Copiado!
        </>
      ) : (
        <>
          <Copy size={14} />
          Copiar para WhatsApp
        </>
      )}
    </button>
  );
}
