import { X, GitCompare } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Fondo } from "../types/fondo";
import {
  formatearMoneda,
  formatearRendimiento,
  rendimientoColorClass,
  formatearAUM,
  cn,
} from "../lib/utils";

interface ComparacionModalProps {
  fondos: Fondo[];
  onClose: () => void;
  onRemove: (fondo: Fondo) => void;
}

const COLORES = ["#6366f1", "#f59e0b", "#10b981"];

// Normalizes all series to base 100 at the earliest shared date
function buildChartData(fondos: Fondo[]) {
  if (fondos.length === 0) return [];

  const series = fondos.map((f) => f.historial_cuotapartes ?? []);
  if (series.every((s) => s.length === 0)) return [];

  // Find common dates range: use longest series length
  const maxLen = Math.max(...series.map((s) => s.length));
  if (maxLen === 0) return [];

  // Align by index from the end (most recent = last)
  const result: Record<string, unknown>[] = [];

  for (let i = 0; i < maxLen; i++) {
    // Get date from the longest series
    const refSeries = series.reduce((a, b) => (a.length >= b.length ? a : b));
    const idx = refSeries.length - maxLen + i;
    if (idx < 0) continue;
    const fecha = refSeries[idx]?.fecha;
    if (!fecha) continue;

    const row: Record<string, unknown> = { fecha };

    for (let fi = 0; fi < fondos.length; fi++) {
      const s = series[fi];
      const sIdx = s.length - maxLen + i;
      if (sIdx >= 0 && sIdx < s.length) {
        // Normalize to base 100 using first available value of this series
        const firstIdx = Math.max(0, s.length - maxLen);
        const base = s[firstIdx]?.valor ?? 1;
        row[`fondo_${fi}`] = base > 0 ? +((s[sIdx].valor / base) * 100).toFixed(4) : null;
      }
    }

    result.push(row);
  }

  return result;
}

function MetricRow({
  label,
  values,
  render,
}: {
  label: string;
  values: Array<unknown>;
  render: (v: unknown) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 pr-4 text-xs text-muted-foreground align-top whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2.5 px-3 text-sm text-foreground align-top">
          {render(v)}
        </td>
      ))}
    </tr>
  );
}

function RendValue({ valor }: { valor: number | null | undefined }) {
  return (
    <span className={cn("font-mono font-medium", rendimientoColorClass(valor))}>
      {formatearRendimiento(valor)}
    </span>
  );
}

export function ComparacionModal({ fondos, onClose, onRemove }: ComparacionModalProps) {
  const chartData = buildChartData(fondos);

  // Reduce chart data points for display (show every 3rd point to avoid clutter)
  const chartDataReduced = chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <GitCompare className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Comparación de fondos</span>
          <span className="text-xs text-muted-foreground">({fondos.length} seleccionados)</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-6">

        {/* Fund headers with remove buttons */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `180px repeat(${fondos.length}, 1fr)` }}>
          <div />
          {fondos.map((fondo, i) => (
            <div
              key={fondo.id}
              className="rounded-lg border bg-card p-3 relative"
              style={{ borderColor: COLORES[i] + "66" }}
            >
              <button
                onClick={() => onRemove(fondo)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div
                className="h-1 rounded-full mb-2"
                style={{ backgroundColor: COLORES[i] }}
              />
              <p className="text-sm font-medium text-foreground leading-snug pr-4 line-clamp-2">
                {fondo.nombre}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{fondo.sociedad_gerente}</p>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "180px" }} />
              {fondos.map((_, i) => <col key={i} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Métrica
                </th>
                {fondos.map((f, i) => (
                  <th
                    key={f.id}
                    className="py-2.5 px-3 text-left text-xs font-medium"
                    style={{ color: COLORES[i] }}
                  >
                    {f.nombre.split(" ").slice(0, 2).join(" ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MetricRow
                label="Tipo"
                values={fondos.map((f) => f.tipo_fondo)}
                render={(v) => <span className="text-xs">{v as string}</span>}
              />
              <MetricRow
                label="Moneda"
                values={fondos.map((f) => f.moneda)}
                render={(v) => <span className="text-xs font-mono">{v as string}</span>}
              />
              <MetricRow
                label="Estado"
                values={fondos.map((f) => f.estado)}
                render={(v) => <span className="text-xs">{v as string}</span>}
              />
              <MetricRow
                label="Cuotaparte"
                values={fondos.map((f) => ({ valor: f.valor_cuotaparte, moneda: f.moneda }))}
                render={(v) => {
                  const { valor, moneda } = v as { valor: number | null; moneda: string };
                  return <span className="font-mono text-xs">{formatearMoneda(valor, moneda)}</span>;
                }}
              />
              <MetricRow
                label="Rend. diario"
                values={fondos.map((f) => f.rendimientos?.diario)}
                render={(v) => <RendValue valor={v as number | null} />}
              />
              <MetricRow
                label="Rend. mensual"
                values={fondos.map((f) => f.rendimientos?.mensual)}
                render={(v) => <RendValue valor={v as number | null} />}
              />
              <MetricRow
                label="Rend. anual"
                values={fondos.map((f) => f.rendimientos?.anual)}
                render={(v) => <RendValue valor={v as number | null} />}
              />
              <MetricRow
                label="YTD"
                values={fondos.map((f) => f.rendimientos?.ytd)}
                render={(v) => <RendValue valor={v as number | null} />}
              />
              <MetricRow
                label="Patrimonio"
                values={fondos.map((f) => ({ aum: f.aum_millones, moneda: f.moneda }))}
                render={(v) => {
                  const { aum, moneda } = v as { aum: number | null | undefined; moneda: string };
                  return <span className="text-xs">{formatearAUM(aum, moneda)}</span>;
                }}
              />
              <MetricRow
                label="Comisión"
                values={fondos.map((f) => f.comision_administracion)}
                render={(v) =>
                  v != null ? (
                    <span className="text-xs">{(v as number).toFixed(1)}% anual</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )
                }
              />
              <MetricRow
                label="Plazo rescate"
                values={fondos.map((f) => f.rescate_plazo)}
                render={(v) => <span className="text-xs">{(v as string | null) ?? "—"}</span>}
              />
              <MetricRow
                label="Horizonte"
                values={fondos.map((f) => f.horizonte_inversion)}
                render={(v) => <span className="text-xs">{(v as string | null) ?? "—"}</span>}
              />
              <MetricRow
                label="Top composición"
                values={fondos.map((f) =>
                  f.composicion_mock.slice(0, 3).map((c) => c.instrumento)
                )}
                render={(v) => (
                  <ul className="text-xs space-y-0.5">
                    {(v as string[]).map((item, i) => (
                      <li key={i} className="text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                )}
              />
            </tbody>
          </table>
        </div>

        {/* Normalized performance chart */}
        {chartDataReduced.length > 1 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Evolución normalizada (base 100) — últimos ~90 días
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartDataReduced} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    new Date(v + "T00:00:00").toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                    })
                  }
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}`}
                  width={40}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const fecha = label
                      ? new Date(label + "T00:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })
                      : "";
                    return (
                      <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
                        <p className="text-muted-foreground">{fecha}</p>
                        {payload.map((p, i) => (
                          <p key={i} style={{ color: p.stroke as string }}>
                            {fondos[i]?.nombre.split(" ").slice(0, 2).join(" ")}:{" "}
                            <span className="font-mono font-medium">
                              {typeof p.value === "number" ? p.value.toFixed(2) : "—"}
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const idx = parseInt(value.replace("fondo_", ""));
                    return (
                      <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                        {fondos[idx]?.nombre.split(" ").slice(0, 3).join(" ")}
                      </span>
                    );
                  }}
                />
                {fondos.map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`fondo_${i}`}
                    stroke={COLORES[i]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
