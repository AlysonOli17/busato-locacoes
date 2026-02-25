import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

interface ExportConfig {
  title: string;
  headers: string[];
  rows: string[][];
  filename: string;
}

/**
 * Loads the Busato logo and returns it as a base64 data URL.
 * Cached after first call.
 */
let logoCache: string | null = null;

async function loadLogo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const resp = await fetch("/images/logo-busato-horizontal.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoCache = reader.result as string;
        resolve(logoCache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Adds the Busato letterhead (logo + line + date) to a jsPDF page.
 * Returns the Y position after the header so content can start below it.
 */
export async function addLetterhead(doc: jsPDF, title: string): Promise<number> {
  const logo = await loadLogo();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 12;

  if (logo) {
    // Logo on the left — 40×14 keeps aspect ratio of the horizontal logo
    doc.addImage(logo, "PNG", 14, y, 40, 14);
  }

  // Title on the right side
  doc.setFontSize(16);
  doc.setTextColor(60, 60, 60);
  doc.text(title, pageWidth - 14, y + 8, { align: "right" });

  y += 18;

  // Separator line
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.7);
  doc.line(14, y, pageWidth - 14, y);

  y += 4;

  // Date
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`,
    pageWidth - 14,
    y,
    { align: "right" },
  );

  y += 6;

  return y;
}

export async function exportToPDF({ title, headers, rows, filename }: ExportConfig) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? "landscape" : "portrait" });

  const startY = await addLetterhead(doc, title);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToExcel({ title, headers, rows, filename }: ExportConfig) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.substring(0, 31));

  // Add header row with styling
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2980B9" } };
  });

  // Add data rows
  rows.forEach((row) => sheet.addRow(row));

  // Auto column widths
  headers.forEach((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => (r[i] || "").length));
    const col = sheet.getColumn(i + 1);
    col.width = Math.min(maxLen + 2, 40);
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
