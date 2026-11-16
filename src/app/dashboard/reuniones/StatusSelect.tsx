"use client";

// «Cliente confirmado» pide el monto del trato (AOV): el navegador no deja guardar sin él.
export function StatusSelect({ opciones, defaultValue, className }: { opciones: string[]; defaultValue: string; className: string }) {
  const marcar = (s: HTMLSelectElement | null) => {
    const aov = s?.form?.elements.namedItem("aov") as HTMLInputElement | null;
    if (aov) aov.required = s!.value === "Cliente confirmado";
  };
  return (
    <select name="status" required defaultValue={defaultValue} className={className} ref={marcar} onChange={(e) => marcar(e.target)}>
      <option value="" disabled>¿Cómo fue?</option>
      {opciones.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}
