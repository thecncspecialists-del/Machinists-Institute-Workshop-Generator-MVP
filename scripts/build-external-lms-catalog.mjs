import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const outputPath = path.resolve("data/external-lms-catalog.json");
const sourceDir = process.env.EXTERNAL_LMS_SOURCE_DIR || "C:/Users/thecn/Downloads";

const sourceFiles = {
  electude: process.env.ELECTUDE_CATALOG_XLSX || path.join(sourceDir, "Electude_1782138937.xlsx"),
  amatrol: process.env.AMATROL_CATALOG_XLSX || path.join(sourceDir, "Amatrol_1782138927.xlsx"),
  "tooling-u": process.env.TOOLING_U_CATALOG_XLSX || path.join(sourceDir, "Tooling_U_1782138859.xlsx")
};

const providers = {
  electude: "Electude",
  amatrol: "Amatrol",
  "tooling-u": "Tooling U"
};

function clean(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeDuration(value) {
  const raw = clean(value);
  if (!raw) return "";
  const parts = raw.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return raw;
  const [hours, minutes] = parts;
  if (hours > 0) return `${hours} hr ${minutes} min`;
  return `${minutes} min`;
}

function readRows(file) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const headerIndex = rows.findIndex((row) => row.map(clean).includes("Name"));
  if (headerIndex < 0) {
    throw new Error(`Could not find Name header in ${file}`);
  }

  const headers = rows[headerIndex].map(clean);
  return rows
    .slice(headerIndex + 1)
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
    )
    .filter((row) => clean(row.Name));
}

function baseItem(provider, row, index) {
  const title = clean(row.Name);
  const catalogId = clean(row["Class Id"]) || clean(row.Module) || `${index + 1}`;
  return {
    id: `${provider}:${slug(catalogId)}:${slug(title) || index + 1}`,
    provider,
    providerLabel: providers[provider],
    title,
    catalogId,
    description: clean(row.Description),
    url: clean(row.Url || row.Link),
    duration: normalizeDuration(row.Duration),
    path: clean(row.Path),
    section: clean(row.Section),
    module: clean(row.Module),
    functionalArea: clean(row["Functional Area"]),
    department: clean(row.Department),
    classId: clean(row["Class Id"]),
    language: clean(row.Language || row.Lanuguage),
    level: clean(row.Level),
    lastUpdated: clean(row["Last Updated"]),
    physicalToolkitId: clean(row["Physical ToolKit ID"])
  };
}

const items = Object.entries(sourceFiles).flatMap(([provider, file]) => {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${providers[provider]} catalog source at ${file}`);
  }
  return readRows(file).map((row, index) => baseItem(provider, row, index));
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(items, null, 2)}\n`);

const counts = items.reduce((acc, item) => {
  acc[item.provider] = (acc[item.provider] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${items.length} external LMS catalog items to ${outputPath}`);
console.log(counts);
