import { useState } from "react";
import { ExternalLink, FileText, PieChart } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Fondo } from "../types/fondo";
import { Badge } from "./ui/badge";
import {
  calcularEstadoDato,
  estadoDatoBadgeClass,
  estadoFondoBadgeClass,
  monedaBadgeClass,
  formatearMoneda,
  formatearFecha,
  formatearRendimiento,
  rendimientoColorClass,
  formatearAUM,
  cn,
} from "../lib/utils";

type Tab = "datos" | "links" | "composicion";

interface FondoDetailPanelProps {
  fondo: Fondo;
}

function LinkRow({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  if (!href) {
    return (
      <div className="flex items-center justify-between py-2.5">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </span>
        <span className="text-xs text-muted-foreground italic">No disponible</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-2.5 group"
    >
      <span className="flex items-center gap-2 text-sm text-foreground group-hover:text-primary transition-colors">
        {icon} {label}
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
    </a>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="col-span-2 text-xs text-muted-foreground self-start pt-0.5">{label}</span>
      <span className="col-span-3 text-sm text-foreground">{value}</span>
    </div>
  );
}

interface RendCeldaProps {
  label: string;
  valor: number | null | undefined;
}

function RendCelda({ label, valor }: RendCeldaProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md bg-muted/30 px-2 py-2.5 gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("text-base font-semibold", rendimientoColorClass(valor))}>
        {formatearRendimiento(valor)}
      </span>
    </div>
  );
}

function CustomTooltip({ active, payload, label, moneda }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  moneda: string;
}) {
  if (!active || !payload?.length) return null;
  const fecha = label ? new Date(label + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">{fecha}</p>
      <p className="font-mono font-medium text-foreground">
        {formatearMoneda(payload[0].value, moneda)}
      </p>
    </div>
  );
}

export function FondoDetailPanel({ fondo }: FondoDetailPanelProps) {
  const [tab, setTab] = useState<Tab>("datos");
  const estadoDato = calcularEstadoDato(fondo.fecha_valor);

  const historial = fondo.historial_cuotapartes ?? [];
  const rendimientos = fondo.rendimientos;

  // Show ~every 30 days as X axis tick
  const tickIndices = new Set<number>();
  if (historial.length > 0) {
    tickIndices.add(0);
    for (let i = 29; i < historial.length; i += 30) tickIndices.add(i);
    tickIndices.add(historial.length - 1);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 pr-14">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <Badge className={monedaBadgeClass(fondo.moneda)}>{fondo.moneda}</Badge>
          <Badge className={estadoFondoBadgeClass(fondo.estado)}>{fondo.estado}</Badge>
          <Badge className={estadoDatoBadgeClass(estadoDato)}>{estadoDato}</Badge>
        </div>
        <h2 className="text-base font-semibold text-foreground leading-snug">{fondo.nombre}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{fondo.sociedad_gerente}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6 shrink-0">
        <div className="flex gap-0">
          {(["datos", "links", "composicion"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "datos" ? "Datos" : t === "links" ? "Links oficiales" : "Composición"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "datos" && (
          <div>
            <DataRow label="Tipo de fondo" value={fondo.tipo_fondo} />
            <DataRow label="Moneda" value={<Badge className={monedaBadgeClass(fondo.moneda)}>{fondo.moneda}</Badge>} />
            <DataRow label="Estado" value={<Badge className={estadoFondoBadgeClass(fondo.estado)}>{fondo.estado}</Badge>} />
            <DataRow label="Sociedad gerente" value={fondo.sociedad_gerente} />
            <DataRow label="Soc. depositaria" value={fondo.sociedad_depositaria} />
            <DataRow
              label="Cuotaparte"
              value={
                <span className="font-mono">
                  {formatearMoneda(fondo.valor_cuotaparte, fondo.moneda)}
                </span>
              }
            />
            <DataRow label="Fecha valor" value={formatearFecha(fondo.fecha_valor)} />
            <DataRow label="Fuente" value={fondo.fuente_dato} />
            <DataRow
              label="Estado dato"
              value={<Badge className={estadoDatoBadgeClass(estadoDato)}>{estadoDato}</Badge>}
            />

            {/* Gráfico histórico */}
            {historial.length > 1 && (
              <div className="mt-4 mb-2">
                <p className="text-xs text-muted-foreground mb-2">Historial cuotaparte — últimos {historial.length} días</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={historial} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        new Date(v + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
                      }
                      ticks={historial
                        .map((_, i) => i)
                        .filter((i) => tickIndices.has(i))
                        .map((i) => historial[i].fecha)}
                    />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip content={<CustomTooltip moneda={fondo.moneda} />} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: "#6366f1" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Grilla rendimientos */}
            {rendimientos && (
              <div className="mt-4 mb-4">
                <p className="text-xs text-muted-foreground mb-2">Rendimientos</p>
                <div className="grid grid-cols-3 gap-2">
                  <RendCelda label="Diario" valor={rendimientos.diario} />
                  <RendCelda label="Semanal" valor={rendimientos.semanal} />
                  <RendCelda label="Mensual" valor={rendimientos.mensual} />
                  <RendCelda label="Trimestral" valor={rendimientos.trimestral} />
                  <RendCelda label="Anual" valor={rendimientos.anual} />
                  <RendCelda label="YTD" valor={rendimientos.ytd} />
                </div>
              </div>
            )}

            {/* Objeto inversión */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1.5">Objeto de inversión</p>
              <p className="text-sm text-foreground leading-relaxed">{fondo.objeto_inversion}</p>
            </div>

            {/* Métricas adicionales */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Información operativa</p>
              <DataRow
                label="Patrimonio (AUM)"
                value={fondo.aum_millones != null ? formatearAUM(fondo.aum_millones, fondo.moneda) : "—"}
              />
              <DataRow
                label="Plazo de rescate"
                value={fondo.rescate_plazo ?? "—"}
              />
              <DataRow
                label="Comisión administración"
                value={fondo.comision_administracion != null ? `${fondo.comision_administracion}% anual` : "—"}
              />
              <DataRow
                label="Horizonte inversión"
                value={fondo.horizonte_inversion ?? "—"}
              />
              <DataRow
                label="Inversión mínima"
                value={
                  fondo.inversion_minima != null
                    ? formatearMoneda(fondo.inversion_minima, fondo.moneda)
                    : "—"
                }
              />
            </div>
          </div>
        )}

        {tab === "links" && (
          <div className="divide-y divide-border/50">
            <LinkRow
              href={fondo.link_cnv}
              label="Ficha en CNV"
              icon={<ExternalLink className="h-4 w-4 text-primary" />}
            />
            <LinkRow
              href={fondo.link_reglamento}
              label="Reglamento de gestión"
              icon={<FileText className="h-4 w-4 text-amber-600" />}
            />
            <LinkRow
              href={fondo.link_composicion}
              label="Composición de cartera"
              icon={<PieChart className="h-4 w-4 text-violet-600" />}
            />
          </div>
        )}

        {tab === "composicion" && (
          <div>
            {fondo.composicion_mock.length === 0 ? (
              <div className="py-12 text-center">
                <PieChart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Composición no disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">
                  {fondo.composicion_fuente === "real"
                    ? `Composición real al ${fondo.composicion_fecha ?? "—"} (CAFCI)`
                    : "Composición estimada — referencia por tipo de fondo"}
                </p>
                {fondo.composicion_mock.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground truncate pr-4">{item.instrumento}</span>
                      <span className="font-mono text-muted-foreground shrink-0">{item.porcentaje}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${item.porcentaje}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border flex justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono text-foreground">
                    {fondo.composicion_mock.reduce((s, i) => s + i.porcentaje, 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-3 shrink-0">
        <p className="text-xs text-muted-foreground">ID: {fondo.id} · Fuente: {fondo.fuente_dato}</p>
      </div>
    </div>
  );
}
