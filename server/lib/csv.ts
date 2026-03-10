export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ImportRowResult {
  row: number;
  status: "imported" | "skipped" | "error";
  reason?: string;
  id?: string;
  name?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: ImportRowResult[];
}

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      fields.push("");
      break;
    }
    if (line[i] === '"') {
      i++;
      let field = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
      else break;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      } else {
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
  }
  return fields;
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, "_")
  );

  const rows = lines.slice(1).map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

export function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function generateCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const csvHeader = headers.join(",");
  const csvRows = rows.map((row) => row.map(escapeCSVField).join(","));
  return [csvHeader, ...csvRows].join("\n");
}
