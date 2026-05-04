import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const [headers, ...data] = rows;
  return data.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h?.trim() ?? `col${i}`, row[i] ?? ""]))
  );
}

// ── NUMBER / DATE HELPERS ─────────────────────────────────────────────────────

// Parse "$52.131" or "$1.316,67" or "52131" → number (Argentine format, dot=thousands)
export function parseNumES(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[$ ]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

// Parse "$104.59" or "3421.00" → number (USD format, dot=decimal)
export function parseUSD(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,\s]/g, "")) || 0;
}

// "enero 26" → "2026-01"
const MESES_ES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};
function spanishHeaderToMonthKey(h: string): string | null {
  const m = h.toLowerCase().trim().match(/^(\w+)\s+(\d{2})$/);
  if (!m) return null;
  const month = MESES_ES[m[1]];
  if (!month) return null;
  return `20${m[2]}-${month}`;
}

// "27/10/2025" or "27/10" → monthKey "2025-10"
export function dateStrToMonthKey(dateStr: string, fallbackYear?: number): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}`;
  if (parts.length === 2 && fallbackYear) return `${fallbackYear}-${parts[1].padStart(2, "0")}`;
  return null;
}

// Parse "27/10/2025" or "27/10" → Date object
export function parseDateAR(dateStr: string, fallbackYear?: number): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("/");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  let year = parts.length === 3 ? parseInt(parts[2]) : (fallbackYear ?? new Date().getFullYear());
  if (year < 100) year += 2000; // handle 2-digit years like "26" → 2026
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

// ── CASHFLOW (by month) ───────────────────────────────────────────────────────

export async function getCashflow(year: "24" | "25" | "26") {
  const sheet = year === "24" ? "Cashflow 24" : year === "25" ? "Cashflow 25" : "Cashflow 26";
  const rows = await getSheet(process.env.SHEET_ID_EERR!, `'${sheet}'!A1:R55`);
  return rows;
}

export async function getCashflowForMonth(monthKey: string): Promise<{
  cashCollected: number;
  totalGastos: number;
  cashflowCC: number;
  totalGastosPersonales: number;
  primerProgramaCC: number;
  renovadosCC: number;
  ahorroFinal: number;
} | null> {
  const [year] = monthKey.split("-").map(Number);
  const sheetYear = year === 2024 ? "24" : year === 2025 ? "25" : year === 2026 ? "26" : null;
  if (!sheetYear) return null;

  const rows = await getCashflow(sheetYear);
  if (rows.length < 2) return null;

  const headerRow = rows[1]; // row 2 has month names
  const colIndex = headerRow.findIndex((v) => spanishHeaderToMonthKey(v ?? "") === monthKey);
  if (colIndex === -1) return null;

  let cashCollected = 0, totalGastos = 0, cashflowCC = 0;
  let totalGastosPersonales = 0, primerProgramaCC = 0, renovadosCC = 0, ahorroFinal = 0;
  for (const row of rows) {
    const label = (row[1] ?? "").trim().toLowerCase();
    const val = parseNumES(row[colIndex] ?? "");
    if (label === "total ingresos") cashCollected = val;
    else if (label === "total gastos cuentas claras") totalGastos = val;
    else if (label === "cashflow cuentas claras") cashflowCC = val;
    else if (label === "total gastos personales") totalGastosPersonales = val;
    else if (label === "cuentas claras (primer programa)") primerProgramaCC = val;
    else if (label === "cuentas claras (renovados)") renovadosCC = val;
    else if (label === "ahorro final") ahorroFinal = val;
  }
  return { cashCollected, totalGastos, cashflowCC, totalGastosPersonales, primerProgramaCC, renovadosCC, ahorroFinal };
}

// Returns monthly "Ahorro final" time series from Cashflow sheets
export async function getAhorroTimeSeries(): Promise<{ month: string; label: string; ahorro: number }[]> {
  const [rows24, rows25, rows26] = await Promise.all([getCashflow("24"), getCashflow("25"), getCashflow("26")]);
  const result: { month: string; label: string; ahorro: number }[] = [];
  const LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  for (const rows of [rows24, rows25, rows26]) {
    if (rows.length < 2) continue;
    const headerRow = rows[1];
    const ahorroRow = rows.find((r) => (r[1] ?? "").trim().toLowerCase() === "ahorro final");
    if (!ahorroRow) continue;
    for (let i = 2; i < headerRow.length; i++) {
      const mk = spanishHeaderToMonthKey(headerRow[i] ?? "");
      if (!mk) continue;
      const val = parseNumES(ahorroRow[i] ?? "");
      if (val !== 0) {
        const [y, m] = mk.split("-").map(Number);
        result.push({ month: mk, label: `${LABELS[m-1]} ${y}`, ahorro: val });
      }
    }
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

// Returns last N months of cash collected vs devengado for trend chart
export async function getCashCollectedTimeSeries(): Promise<{ month: string; label: string; cashCollected: number }[]> {
  const [rows25, rows26] = await Promise.all([getCashflow("25"), getCashflow("26")]);
  const result: { month: string; label: string; cashCollected: number }[] = [];

  for (const rows of [rows25, rows26]) {
    if (rows.length < 2) continue;
    const headerRow = rows[1];
    const totalRow = rows.find((r) => (r[1] ?? "").trim().toLowerCase() === "total ingresos");
    if (!totalRow) continue;
    for (let i = 2; i < headerRow.length; i++) {
      const mk = spanishHeaderToMonthKey(headerRow[i] ?? "");
      if (!mk) continue;
      const val = parseNumES(totalRow[i] ?? "");
      if (val > 0) {
        const [y, m] = mk.split("-").map(Number);
        const label = `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m-1]} ${y}`;
        result.push({ month: mk, label, cashCollected: val });
      }
    }
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

// ── EERR CC (devengado / counts by month) ─────────────────────────────────────
// Row 35 = month headers: "ene 24", "feb 24", ..., "Anual", "ene 25", ...
// Key rows: 688=Total Ingresos Devengados, 723=Total Clientes Activos

const MESES_ABREV: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sept: "09", oct: "10", nov: "11", dic: "12",
};

// "ene 26" or "abr 25" → "2026-01" / "2025-04"
function eerrAbrevToMonthKey(h: string): string | null {
  const m = h.toLowerCase().trim().match(/^(\w+)\s+(\d{2})$/);
  if (!m) return null;
  const month = MESES_ABREV[m[1]];
  if (!month) return null;
  return `20${m[2]}-${month}`;
}

// Reads Total Clientes Activos directly from row 723 (headers in row 35)
export async function getClientesActivosForMonth(monthKey: string): Promise<number | null> {
  // Fetch header row (35) + data row (723) in one call
  const [headerRows, dataRows] = await Promise.all([
    getSheet(process.env.SHEET_ID_EERR!, "'EERR CC'!A35:AZ35"),
    getSheet(process.env.SHEET_ID_EERR!, "'EERR CC'!A723:AZ723"),
  ]);
  const headerRow = headerRows[0] ?? [];
  const dataRow   = dataRows[0]   ?? [];
  const colIndex  = headerRow.findIndex((v) => eerrAbrevToMonthKey(v ?? "") === monthKey);
  if (colIndex === -1) return null;
  const val = parseNumES(dataRow[colIndex] ?? "");
  return val > 0 ? val : null;
}

export async function getEERRCCForMonth(monthKey: string): Promise<{
  ingresosDevengados: number | null;
  totalGastosVariables: number | null;
  resultadoBruto: number | null;
  totalGastosFijos: number | null;
  resultadoNeto: number | null;
  clientesPrimerPrograma: number | null;
  clientesRenovados: number | null;
  downsell: number | null;
  totalClientesActivos: number | null;
  clientesNuevosCerrados: number | null;
  gastosMarketingRedes: number | null;
  cac: number | null;
  ticketPromedio: number | null;
  grossProfit: number | null;
  numMeses: number | null;
  ltgp: number | null;
  relacionLTGPCAC: number | null;
} | null> {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "'EERR CC'!A35:AZ742");
  if (!rows[0]) return null;

  const headerRow = rows[0];
  const colIndex = headerRow.findIndex((v) => eerrAbrevToMonthKey(v ?? "") === monthKey);
  if (colIndex === -1) return null;

  const result = {
    ingresosDevengados: null as number | null,
    totalGastosVariables: null as number | null,
    resultadoBruto: null as number | null,
    totalGastosFijos: null as number | null,
    resultadoNeto: null as number | null,
    clientesPrimerPrograma: null as number | null,
    clientesRenovados: null as number | null,
    downsell: null as number | null,
    totalClientesActivos: null as number | null,
    clientesNuevosCerrados: null as number | null,
    gastosMarketingRedes: null as number | null,
    cac: null as number | null,
    ticketPromedio: null as number | null,
    grossProfit: null as number | null,
    numMeses: null as number | null,
    ltgp: null as number | null,
    relacionLTGPCAC: null as number | null,
  };

  for (const row of rows) {
    const label = (row[1] ?? "").trim();
    const val = row[colIndex];
    if (!val) continue;
    const n = parseNumES(val);
    if (label === "Total Ingresos Devengados") result.ingresosDevengados = n;
    else if (label === "Total gastos variables") result.totalGastosVariables = n;
    else if (label === "Resultado Bruto") result.resultadoBruto = n;
    else if (label === "Total Gastos Fijos") result.totalGastosFijos = n;
    else if (label === "Resultado Neto") result.resultadoNeto = n;
    else if (label === "Clientes 1er programa") result.clientesPrimerPrograma = n;
    else if (label === "Clientes Renovados") result.clientesRenovados = n;
    else if (label === "Downsell") result.downsell = n;
    else if (label === "Total Clientes Activos") result.totalClientesActivos = n;
    else if (label === "Clientes Nuevos cerrados") result.clientesNuevosCerrados = n;
    else if (label === "Gastos Marketing y Redes") result.gastosMarketingRedes = n;
    else if (label === "CAC") result.cac = n;
    else if (label === "Ticket Promedio") result.ticketPromedio = n;
    else if (label === "Gross Profit") result.grossProfit = n;
    else if (label === "# de meses") result.numMeses = n;
    else if (label === "LTGP") result.ltgp = n;
    else if (label === "Relacion LTGP:CAC") result.relacionLTGPCAC = n;
  }
  return result;
}

// Returns devengado time series for trend chart (reads header row + data row)
export async function getDevengadosTimeSeries(): Promise<{ month: string; label: string; devengados: number }[]> {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "'EERR CC'!A35:AZ688");
  if (rows.length < 2) return [];

  const headerRow = rows[0]; // row 35
  const dataRow = rows[rows.length - 1]; // last fetched row = 688
  const result: { month: string; label: string; devengados: number }[] = [];
  const LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  for (let i = 0; i < headerRow.length; i++) {
    const mk = eerrAbrevToMonthKey(headerRow[i] ?? "");
    if (!mk) continue;
    const val = parseNumES(dataRow[i] ?? "");
    if (val > 0) {
      const [y, m] = mk.split("-").map(Number);
      result.push({ month: mk, label: `${LABELS[m-1]} ${y}`, devengados: val });
    }
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

// Returns time series for Total Clientes Activos, 1er Programa, Renovados, Downsell
export async function getClientesTrend(): Promise<{
  month: string; label: string;
  total: number; primerPrograma: number; renovados: number; downsell: number;
}[]> {
  // Read header row (35) + rows 738–741 in one fetch
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "'EERR CC'!A35:AZ742");
  if (rows.length < 2) return [];

  const headerRow = rows[0]; // row 35
  const LABELS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  // Find data rows by label
  const findRow = (label: string) => rows.find((r) => (r[1] ?? "").trim() === label) ?? [];
  const rowPrimer = findRow("Clientes 1er programa");
  const rowRenov  = findRow("Clientes Renovados");
  const rowDown   = findRow("Downsell");
  const rowTotal  = findRow("Total Clientes Activos");

  const result: { month: string; label: string; total: number; primerPrograma: number; renovados: number; downsell: number }[] = [];

  for (let i = 0; i < headerRow.length; i++) {
    const mk = eerrAbrevToMonthKey(headerRow[i] ?? "");
    if (!mk) continue;
    const total = parseNumES(rowTotal[i] ?? "");
    const primer = parseNumES(rowPrimer[i] ?? "");
    const renov  = parseNumES(rowRenov[i]  ?? "");
    const down   = parseNumES(rowDown[i]   ?? "");
    if (total === 0 && primer === 0 && renov === 0) continue; // skip empty months
    const [y, m] = mk.split("-").map(Number);
    result.push({ month: mk, label: `${LABELS_SHORT[m-1]} ${y}`, total, primerPrograma: primer, renovados: renov, downsell: down });
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

// ── FINANZAS (EERR raw data) ──────────────────────────────────────────────────

export async function getIngresos() {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "Ingresos!A:H");
  return rowsToObjects(rows);
}

export async function getEgresos() {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "Egresos!A:G");
  return rowsToObjects(rows);
}

export async function getEERR() {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "EERR CC!A:M");
  return rows;
}

export async function getGrossProfit() {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "GP!A:H");
  return rows;
}

export async function getLTGPCAC() {
  const rows = await getSheet(process.env.SHEET_ID_EERR!, "'LTGP:CAC'!A:K");
  return rows;
}

export async function getSueldos(year: "25" | "26") {
  const sheet = year === "25" ? "Sueldos 25" : "Sueldos 26";
  const rows = await getSheet(process.env.SHEET_ID_EERR!, `'${sheet}'!A:M`);
  return rows;
}

// ── MARKETING (METRICAS SETTING) ──────────────────────────────────────────────

export async function getMarketingTotales() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Totales!A:M");
  return rowsToObjects(rows);
}

export async function getMarketingInversion() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Inversion!A:H");
  return rowsToObjects(rows);
}

export async function getMarketingVSL() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "VSL!A:D");
  return rowsToObjects(rows);
}

export async function getMarketingMsgIG() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "MSG IG!A:K");
  return rowsToObjects(rows);
}

export async function getMarketingFMA() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "FMA!A:N");
  return rowsToObjects(rows);
}

export async function getMarketingResumen() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Resumen!A:J");
  return rows;
}

export async function getMarketingRubros() {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Rubros!A:E");
  return rowsToObjects(rows);
}

// MSG IG positional mapping (col B=Gasto, D=Leads, G=Pitch, H=Permiso, I=AgEnviada, J=Agendado)
export async function getSettingMsgIG(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "MSG IG!A:J");
  if (rows.length < 2) return [];
  return rows.slice(1).filter((r) => r[0]?.trim()).map((row) => ({
    "Fecha":          row[0] ?? "",
    "Gasto":          row[1] ?? "",  // B
    "Total leads":    row[3] ?? "",  // D
    "Pitch":          row[6] ?? "",  // G
    "Permiso":        row[7] ?? "",  // H
    "Agenda enviada": row[8] ?? "",  // I
    "Agendado":       row[9] ?? "",  // J
  }));
}

// Tipos de Leads (MSG IG breakdown) — col A=Fecha, B=TipoA, C=TipoB, D=TipoC, E=TipoD
export async function getSettingTiposLeads(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Tipos de Leads!A:E");
  if (rows.length < 2) return [];
  return rows.slice(1).filter((r) => r[0]?.trim()).map((row) => ({
    "Fecha":  row[0] ?? "",
    "Tipo A": row[1] ?? "",  // B
    "Tipo B": row[2] ?? "",  // C
    "Tipo C": row[3] ?? "",  // D
    "Tipo D": row[4] ?? "",  // E
  }));
}

// Análisis FMA (Outbound) — G=Inicios, K=TienenNeg, N=NoTienenNeg, O=<1a, P=1-3a, Q=>3a
export async function getSettingAnalisisFMA(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_SETTING!, "Analisis FMA!A:Q");
  if (rows.length < 2) return [];
  return rows.slice(1).filter((r) => r[0]?.trim()).map((row) => ({
    "Fecha":             row[0]  ?? "",
    "Inicios":           row[6]  ?? "",  // G
    "Tienen negocio":    row[10] ?? "",  // K
    "No tienen negocio": row[13] ?? "",  // N
    "Negocio <1 año":    row[14] ?? "",  // O
    "Negocio 1-3 años":  row[15] ?? "",  // P
    "Negocio >3 años":   row[16] ?? "",  // Q
  }));
}

// Marketing gasto total for a month (for CAC calculation)
export async function getMarketingGastoForMonth(monthKey: string): Promise<number> {
  const [year] = monthKey.split("-").map(Number);
  const [vsl, msgIG, fma] = await Promise.all([getMarketingVSL(), getMarketingMsgIG(), getMarketingFMA()]);

  const matchMonth = (dateStr: string) => dateStrToMonthKey(dateStr, year) === monthKey;

  const gastoVSL = vsl.filter((r) => matchMonth(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
  const gastoIG = msgIG.filter((r) => matchMonth(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["$"] ?? ""), 0);
  const gastoFMA = fma.filter((r) => matchMonth(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["$"] ?? ""), 0);

  return gastoVSL + gastoIG + gastoFMA;
}

// ── VENTAS (EQUIPO VENTAS) ────────────────────────────────────────────────────

export async function getVentasMetrics2026() {
  const rows = await getSheet(process.env.SHEET_ID_VENTAS!, "Metrics 2026!A:Z");
  return rows;
}

export async function getVentasReuniones(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_VENTAS!, "Resumen Reuniones!A:T");
  if (rows.length < 2) return [];
  // Map positionally — col R header is blank spaces so we can't rely on rowsToObjects
  return rows.slice(1).map((row) => ({
    "Prospecto":            row[1]  ?? "",  // B
    "Canal":                row[3]  ?? "",  // D
    "Tipo de lead":         row[9]  ?? "",  // J
    "Fecha de la agenda":   row[10] ?? "",  // K
    "Fecha de reunion":     row[11] ?? "",  // L
    "Closer":               row[12] ?? "",  // M
    "Facturacion":          row[14] ?? "",  // O
    "Status":               row[17] ?? "",  // R
    "Cash Collected":       row[19] ?? "",  // T
  }));
}

// Status values (col R) that count as a closed deal
export function isClosedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("cliente confirmado") || s.includes("seña pie adentro") || s.includes("señó pie adentro");
}

// Effective = all rows with a reunion date, minus no-shows, cancelled, no-presentados
export function isEffectiveReunion(status: string): boolean {
  const s = status.toLowerCase();
  return !s.includes("no show") && !s.includes("cancelado") && !s.includes("no presentado");
}

export async function getVentasMsgWapp() {
  const rows = await getSheet(process.env.SHEET_ID_VENTAS!, "MSG Wapp!A:J");
  return rowsToObjects(rows);
}

export async function getVentasVSL() {
  const rows = await getSheet(process.env.SHEET_ID_VENTAS!, "VSL!A:D");
  return rowsToObjects(rows);
}

// Filter reuniones by date — defaults to "Fecha de reunion" (col L)
export function filterReuniones(
  reuniones: Record<string, string>[],
  opts: { monthKey?: string; from?: string; to?: string; dateCol?: string }
): Record<string, string>[] {
  if (!opts.monthKey && !opts.from && !opts.to) return reuniones;
  const dateCol = opts.dateCol ?? "Fecha de reunion";
  const [refYear] = (opts.monthKey ?? `${new Date().getFullYear()}-01`).split("-").map(Number);

  return reuniones.filter((r) => {
    const dateStr = r[dateCol] ?? "";
    if (!dateStr) return false;
    if (opts.monthKey) {
      return dateStrToMonthKey(dateStr, refYear) === opts.monthKey;
    }
    const d = parseDateAR(dateStr, refYear);
    if (!d) return false;
    if (opts.from && d < new Date(opts.from)) return false;
    if (opts.to && d > new Date(opts.to + "T23:59:59")) return false;
    return true;
  });
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// Returns the last-update date stored in A1 of "Status y pago"
export async function getStatusPagoFecha(): Promise<string | null> {
  const rows = await getSheet(process.env.SHEET_ID_STATUS_CLIENTES!, "Status y pago!A1");
  return rows?.[0]?.[0]?.trim() || null;
}

// Status y pago — A1 = last-update date (meta), row 2 = headers, row 3+ = data
// A=Cliente, C=Consultor, M=DíasProxPago (negative = debtor), N=MontoAdeudado
export async function getStatusPago(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_STATUS_CLIENTES!, "Status y pago!A:N");
  if (rows.length < 3) return [];
  return rows.slice(2).filter((r) => r[0]?.trim()).map((row) => ({
    "Cliente":   row[0]  ?? "",  // A
    "Consultor": row[2]  ?? "",  // C
    "Closer":    row[3]  ?? "",  // D
    "Dias":      row[12] ?? "",  // M — negative = days overdue
    "Monto":     row[13] ?? "",  // N — amount owed
  }));
}

// Comisiones — Resumen Reuniones extended with payment columns
// B=Prospecto, M=Closer, N=Origen, O=Facturacion, P=ComSet, Q=ComCloser, R=Status
export async function getVentasComisiones(): Promise<Record<string, string>[]> {
  const rows = await getSheet(process.env.SHEET_ID_VENTAS!, "Resumen Reuniones!A:R");
  if (rows.length < 2) return [];
  return rows.slice(1).filter((r) => r[1]?.trim()).map((row) => ({
    "Prospecto":   row[1]  ?? "",  // B
    "Closer":      row[12] ?? "",  // M
    "Origen":      row[13] ?? "",  // N — "Setting", "Publi a VSL", etc.
    "Facturacion": row[14] ?? "",  // O
    "Com Set":     row[15] ?? "",  // P — TRUE/VERDADERO = paid
    "Com Closer":  row[16] ?? "",  // Q — TRUE/VERDADERO = paid
    "Status":      row[17] ?? "",  // R
  }));
}

// ── OPERACIONES ───────────────────────────────────────────────────────────────

export async function getStatusClientes() {
  const rows = await getSheet(process.env.SHEET_ID_STATUS_CLIENTES!, "Status y pago!A:P");
  // Row 1 = last update date (A1), Row 2 = headers, Row 3+ = data
  return rowsToObjects(rows.slice(1));
}

export async function getHistorialClientes() {
  const rows = await getSheet(process.env.SHEET_ID_STATUS_CLIENTES!, "Historial clientes!A:K");
  return rowsToObjects(rows);
}

export async function getDownsell() {
  const rows = await getSheet(process.env.SHEET_ID_STATUS_CLIENTES!, "Downsell!A:K");
  return rowsToObjects(rows);
}

export async function getAnalisisClientes() {
  const rows = await getSheet(process.env.SHEET_ID_ANALISIS_CLIENTES!, "Resumen por cliente!A:L");
  return rowsToObjects(rows);
}

export async function getFeedbackData() {
  const rows = await getSheet(process.env.SHEET_ID_FEEDBACK!, "Feedback Mensual!A:N");
  return rowsToObjects(rows);
}

export async function getFeedbackEstadisticas() {
  const rows = await getSheet(process.env.SHEET_ID_FEEDBACK!, "Estadisticas!A:M");
  return rows;
}

// Filter feedback by month (uses "Marca temporal" column: "24/10/2024 14:41:17")
export function filterFeedbackByMonth(
  feedback: Record<string, string>[],
  opts: { monthKey?: string; from?: string; to?: string }
): Record<string, string>[] {
  if (!opts.monthKey && !opts.from && !opts.to) return feedback;
  const [refYear] = (opts.monthKey ?? `${new Date().getFullYear()}-01`).split("-").map(Number);

  return feedback.filter((r) => {
    const ts = r["Marca temporal"] ?? "";
    if (!ts) return false;
    const datePart = ts.split(" ")[0]; // "24/10/2024"
    if (opts.monthKey) {
      return dateStrToMonthKey(datePart, refYear) === opts.monthKey;
    }
    const d = parseDateAR(datePart, refYear);
    if (!d) return false;
    if (opts.from && d < new Date(opts.from)) return false;
    if (opts.to && d > new Date(opts.to + "T23:59:59")) return false;
    return true;
  });
}

// Returns next month key — used for feedback (feedbacks are 1 month behind)
export function nextMonthKey(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// Reads Analisis Clientes "Resumen metricas" — returns last N months of data
export async function getAnalisisClientesResumen(): Promise<{
  months: string[]; // "01/2025", "02/2025", ...
  rows: { label: string; values: string[] }[];
}> {
  const data = await getSheet(process.env.SHEET_ID_ANALISIS_CLIENTES!, "'Resumen metricas'!A1:Z20");
  if (!data.length) return { months: [], rows: [] };
  const [headerRow, ...dataRows] = data;
  const months = (headerRow.slice(1) as string[]).filter(Boolean);
  const WANTED = new Set([
    "Cantidad de Clientes vencidos",
    "Facturacion inicial ($)",
    "Facturacion final primer programa ($)",
    "Variacion Facturacion",
    "Rentabilidad Neta inicial ($)",
    "Rentabilidad Neta final primer programa ($)",
    "Variacion Rentabilidad Neta",
    "Conocimiento de números inicial",
    "Conocimiento de números final",
    "Mejora en conocimiento",
    "Tranquilidad Inicial",
    "Tranquilidad Final",
    "Mejora en tranquilidad",
  ]);
  const rows = dataRows
    .filter((r) => WANTED.has((r[0] ?? "").trim()))
    .map((r) => ({ label: (r[0] ?? "").trim(), values: r.slice(1) as string[] }));
  return { months, rows };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatARS(n: number): string {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

export function formatUSD(n: number): string {
  return `USD ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── PATRIMONIO ────────────────────────────────────────────────────────────────

async function getSheetUnformatted(
  spreadsheetId: string,
  range: string
): Promise<(string | number | boolean)[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueRenderOption: "UNFORMATTED_VALUE" as any,
  });
  return (res.data.values ?? []) as (string | number | boolean)[][];
}

// Excel serial date → "mar-23" label
function serialToLabel(serial: number): string {
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const date = new Date((serial - 25569) * 86400 * 1000);
  return `${MESES[date.getUTCMonth()]}-${String(date.getUTCFullYear()).slice(2)}`;
}

// Excel serial date → "YYYY-MM" key
function serialToMonthKey(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PatrimonioClase =
  | "Cash"
  | "Acciones"
  | "Crypto"
  | "Real Estate Propio"
  | "Real Estate Inversión"
  | "Crédito Dado";

export interface PortfolioAsset {
  activo: string;
  clase: PatrimonioClase;
  moneda: string;
  cantidad: number;
  precioUSD: number;
  valorUSD: number;
  pctTotal: number;
  pctSinAF: number;
  riesgo: string;
  liquidez: string;
  notas: string;
}

export interface HistoriaRow {
  label: string;       // "mar-23"
  monthKey: string;    // "2023-03"
  total: number;
  rePropio: number;
  cash: number;
  acciones: number;
  crypto: number;
  reInversion: number;
  creditos: number;
  totalSinAF: number;
  varUSD: number | null;
  varPct: number | null;
}

export async function getPatrimonioPortfolio(): Promise<PortfolioAsset[]> {
  const rows = await getSheetUnformatted(
    process.env.SHEET_ID_PATRIMONIO!,
    "Portfolio!A:K"
  );
  if (rows.length < 2) return [];
  // Row 0 = headers, rows 1+ = data; stop before summary rows (clase column becomes empty/label)
  const VALID_CLASES = new Set([
    "Cash","Acciones","Crypto",
    "Real Estate Propio","Real Estate Inversión","Crédito Dado",
  ]);
  return rows.slice(1).filter((r) => VALID_CLASES.has(String(r[1] ?? "").trim())).map((r) => ({
    activo:    String(r[0]  ?? "").trim(),
    clase:     String(r[1]  ?? "").trim() as PatrimonioClase,
    moneda:    String(r[2]  ?? "").trim(),
    cantidad:  Number(r[3]  ?? 0),
    precioUSD: Number(r[4]  ?? 0),
    valorUSD:  Number(r[5]  ?? 0),
    pctTotal:  Number(r[6]  ?? 0),
    pctSinAF:  Number(r[7]  ?? 0),
    riesgo:    String(r[8]  ?? "").trim(),
    liquidez:  String(r[9]  ?? "").trim(),
    notas:     String(r[10] ?? "").trim(),
  }));
}

export async function getPatrimonioHistoria(): Promise<HistoriaRow[]> {
  const rows = await getSheetUnformatted(
    process.env.SHEET_ID_PATRIMONIO!,
    "Historia!A:L"
  );
  if (rows.length < 2) return [];
  return rows.slice(1)
    .filter((r) => typeof r[0] === "number" && r[0] > 0)
    .map((r) => {
      const serial = Number(r[0]);
      const varRaw = r[9];
      const pctRaw = r[10];
      return {
        label:      serialToLabel(serial),
        monthKey:   serialToMonthKey(serial),
        total:      Number(r[1] ?? 0),
        rePropio:   Number(r[2] ?? 0),
        cash:       Number(r[3] ?? 0),
        acciones:   Number(r[4] ?? 0),
        crypto:     Number(r[5] ?? 0),
        reInversion:Number(r[6] ?? 0),
        creditos:   Number(r[7] ?? 0),
        totalSinAF: Number(r[8] ?? 0),
        varUSD:     typeof varRaw === "number" ? varRaw : null,
        varPct:     typeof pctRaw === "number" ? pctRaw : null,
      };
    });
}
