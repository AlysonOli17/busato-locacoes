import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula horas trabalhadas em um período usando interpolação de média diária entre leituras.
 * Entre duas leituras consecutivas, as horas são distribuídas uniformemente pelos dias.
 * Se uma nova leitura é inserida entre duas existentes, as médias são recalculadas.
 *
 * @param readings - Todas as leituras 'Trabalho' do equipamento (inclusive antes do período)
 * @param periodoInicio - Data início do período (YYYY-MM-DD)
 * @param periodoFim - Data fim do período (YYYY-MM-DD)
 */
export function calcularHorasInterpoladas(
  readings: { data: string; horimetro_final: number }[],
  periodoInicio: string,
  periodoFim: string
): { totalHoras: number; mediaHorasDia: number } {
  if (readings.length === 0) return { totalHoras: 0, mediaHorasDia: 0 };

  // Deduplicate: keep highest horimetro_final per day
  const byDay = new Map<string, number>();
  for (const r of readings) {
    const d = String(r.data);
    const v = Number(r.horimetro_final);
    if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
  }

  const sorted = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, horim]) => ({ data, horim }));

  if (sorted.length < 2) return { totalHoras: 0, mediaHorasDia: 0 };

  const daysDiff = (a: string, b: string) =>
    Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

  // Interpolate horímetro value at a given date using surrounding readings
  const interpolateAt = (dateStr: string): number | null => {
    const exact = byDay.get(dateStr);
    if (exact !== undefined) return exact;

    let prevIdx = -1, nextIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].data < dateStr) { prevIdx = i; break; }
    }
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].data > dateStr) { nextIdx = i; break; }
    }

    if (prevIdx === -1) return null; // Before first reading
    if (nextIdx === -1) {
      // After last reading: extrapolate using average daily rate
      if (sorted.length >= 2) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalDays = daysDiff(first.data, last.data);
        if (totalDays > 0) {
          const dailyRate = (last.horim - first.horim) / totalDays;
          const daysFromLast = daysDiff(last.data, dateStr);
          return last.horim + dailyRate * daysFromLast;
        }
      }
      return null;
    }

    const prev = sorted[prevIdx];
    const next = sorted[nextIdx];
    const totalDays = daysDiff(prev.data, next.data);
    if (totalDays <= 0) return prev.horim;
    const daysFrom = daysDiff(prev.data, dateStr);
    return prev.horim + (next.horim - prev.horim) * daysFrom / totalDays;
  };

  // Try to interpolate at period boundaries
  let horimInicio = interpolateAt(periodoInicio);
  let horimFim = interpolateAt(periodoFim);

  // Fallback: if can't interpolate at start, use first reading in/after period
  if (horimInicio === null) {
    const firstInPeriod = sorted.find(s => s.data >= periodoInicio);
    horimInicio = firstInPeriod ? firstInPeriod.horim : null;
  }

  // Fallback: if can't interpolate at end, use last reading in/before period
  if (horimFim === null) {
    const lastInPeriod = [...sorted].reverse().find(s => s.data <= periodoFim);
    horimFim = lastInPeriod ? lastInPeriod.horim : null;
  }

  if (horimInicio === null || horimFim === null) return { totalHoras: 0, mediaHorasDia: 0 };

  const totalHoras = Math.max(0, Number((horimFim - horimInicio).toFixed(1)));
  const diasPeriodo = Math.max(1, daysDiff(periodoInicio, periodoFim));
  const mediaHorasDia = Number((totalHoras / diasPeriodo).toFixed(2));

  return { totalHoras, mediaHorasDia };
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
