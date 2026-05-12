// Pequeno utilitário para gerar e baixar CSV no client.
// Sem dependências.

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const buildCsv = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
  separator: "," | ";" = ";",
): string => {
  const head = headers.map(escapeCell).join(separator);
  const body = rows.map((r) => r.map(escapeCell).join(separator)).join("\r\n");
  // BOM para abrir no Excel com acentuação correta
  return "\ufeff" + head + "\r\n" + body;
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
