import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gera label padronizado para equipamento, pesquisável por tipo, modelo, placa e número de série.
 * Formato: "Tipo Modelo (Placa) - NS: xxx"
 */
export function getEquipLabel(eq: {
  tipo?: string | null;
  modelo?: string | null;
  tag_placa?: string | null;
  numero_serie?: string | null;
} | undefined | null, fallback = "—"): string {
  if (!eq) return fallback;
  let label = `${eq.tipo || ""} ${eq.modelo || ""}`.trim();
  if (eq.tag_placa) label += ` (${eq.tag_placa})`;
  if (eq.numero_serie) label += ` - NS: ${eq.numero_serie}`;
  return label || fallback;
}
