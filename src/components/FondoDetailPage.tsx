import { useState } from "react";
import { ArrowLeft, ExternalLink, FileText, PieChart as PieChartIcon } from "lucide-react";
import type { Fondo } from "../types/fondo";
import { Badge } from "./ui/badge";
import {
  calcularEstadoDato,
  estadoDatoBadgeClass,
  estadoFondoBadgeClass,
  monedaBadgeClass,
  formatearMoneda,
  formatearFecha,
  cn,
} from "../lib/utils";

// ─── Paleta de colores (por rank del activo) ──────────────────────────────────

const COLORS = [
  "#2563eb", // azul
  "#7c3aed", // violeta
  "#0891b2", // cyan
  "#059669", // verde
  "#d97706", // naranja
  "#dc2626", // rojo
  "#db2777", // rosa
  "#65a30d", // lima
  "#0284c7", // celeste
  "#9333ea", // púrpura
  "#f59e0b", // amarillo
  "#10b981", // esmeralda
  "#94a3b8", // gris (resto de activos)
];

type Vista = "barras" | "torta" | "tabla";

interface ItemConColor {
  instrumento: string;
  porcentaje: number;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extraerClase(nombre: string): { nombreCorto: string; clase: string | null } {
  const match = nombre.match(/^(.*?)\s*[-–]\s*(Clase\s+\S+)\s*$/i);
  if (match) return { nombreCorto: match[1].trim(), clase: match[2].trim() };
  return { nombreCorto: nombre, clase: null };
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, sweepDeg: number
): string {
  // Clamp full-circle to avoid degenerate SVG arc
  const effectiveSweep = Math.min(sweepDeg, 359.99);
  const endDeg = startDeg + effectiveSweep;
  const largeArc = effectiveSweep > 180 ? 1 : 0;
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, endDeg);
  const i1 = polarToCartesian(cx, cy, innerR, endDeg);
  const i2 = polarToCartesian(cx, cy, innerR, startDeg);
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// ─── Sub-componentes de layout ────────────────────────────────────────────────

function LinkItem({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
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

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

// ─── Vista Barras ─────────────────────────────────────────────────────────────

function VistaBarras({ items }: { items: ItemConColor[] }) {
  const maxPct = Math.max(...items.map((i) => i.porcentaje), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span
            className="w-52 shrink-0 text-sm text-foreground truncate"
            title={item.instrumento}
          >
            {item.instrumento}
          </span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(item.porcentaje / maxPct) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span
            className="w-12 text-right text-sm font-semibold font-mono shrink-0"
            style={{ color: item.color }}
          >
            {item.porcentaje.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Vista Torta (SVG puro) ───────────────────────────────────────────────────

function VistaTorta({ items }: { items: ItemConColor[] }) {
  const total = items.reduce((s, i) => s + i.porcentaje, 0) || 1;
  const cx = 100, cy = 100, outerR = 92, innerR = 41;

  let currentAngle = 0;
  const segments = items.map((item) => {
    const sweep = (item.porcentaje / total) * 360;
    const path = describeArc(cx, cy, outerR, innerR, currentAngle, sweep);
    currentAngle += sweep;
    return { ...item, path };
  });

  return (
    <div className="flex items-start gap-8 h-full">
      {/* Donut SVG */}
      <div className="shrink-0">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {segments.map((seg, i) => (
            <path
              key={i}
              d={seg.path}
              fill={seg.color}
              stroke="white"
              strokeWidth="1.5"
            />
          ))}
          <text
            x="100" y="89"
            textAnchor="middle"
            fontSize="11"
            fill="#6B7280"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            Total
          </text>
          <text
            x="100" y="113"
            textAnchor="middle"
            fontSize="28"
            fontWeight="700"
            fill="#111827"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {items.length}
          </text>
          <text
            x="100" y="129"
            textAnchor="middle"
            fontSize="11"
            fill="#6B7280"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            activos
          </text>
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 self-center">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="shrink-0 h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span
              className="flex-1 text-sm text-foreground truncate"
              title={item.instrumento}
            >
              {item.instrumento}
            </span>
            <span
              className="shrink-0 text-sm font-semibold font-mono"
              style={{ color: item.color }}
            >
              {item.porcentaje.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vista Tabla ──────────────────────────────────────────────────────────────

function VistaTabla({ items }: { items: ItemConColor[] }) {
  const maxPct = Math.max(...items.map((i) => i.porcentaje), 1);
  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="border-b border-border">
          <th className="py-2 w-8 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider pr-3">
            #
          </th>
          <th className="py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Activo
          </th>
          <th className="py-2 w-28 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Proporción
          </th>
          <th className="py-2 w-14 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr
            key={idx}
            className="border-b border-border/40 hover:bg-muted/40 transition-colors"
          >
            <td className="py-2 text-muted-foreground font-mono text-xs pr-3">{idx + 1}</td>
            <td className="py-2 text-foreground truncate max-w-[1px]" title={item.instrumento}>
              {item.instrumento}
            </td>
            <td className="py-2">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.porcentaje / maxPct) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </td>
            <td
              className="py-2 text-right font-semibold font-mono"
              style={{ color: item.color }}
            >
              {item.porcentaje.toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface FondoDetailPageProps {
  fondo: Fondo;
  onVolver: () => void;
}

export function FondoDetailPage({ fondo, onVolver }: FondoDetailPageProps) {
  const [vista, setVista] = useState<Vista>("barras");

  const estadoDato = calcularEstadoDato(fondo.fecha_valor);
  const { nombreCorto, clase } = extraerClase(fondo.nombre);

  const items: ItemConColor[] = (fondo.composicion_mock ?? []).map((item, idx) => ({
    instrumento: item.instrumento,
    porcentaje: item.porcentaje,
    color: COLORS[idx % COLORS.length],
  }));

  const tieneComposicion = items.length > 0;

  const composicionLabel =
    fondo.composicion_fuente === "real"
      ? `Composición real al ${fondo.composicion_fecha ?? "—"} · Fuente: CAFCI`
      : "Composición estimada · Referencia por tipo de fondo";

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center px-4 gap-3">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <div className="h-4 w-px bg-border shrink-0" />
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span className="text-muted-foreground shrink-0">Fondos CNV</span>
          <span className="text-muted-foreground shrink-0">›</span>
          <span className="text-foreground truncate font-medium">{fondo.nombre}</span>
        </div>
        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={monedaBadgeClass(fondo.moneda)}>{fondo.moneda}</Badge>
          <Badge className={estadoFondoBadgeClass(fondo.estado)}>{fondo.estado}</Badge>
          <Badge className={estadoDatoBadgeClass(estadoDato)}>{estadoDato}</Badge>
        </div>
      </header>

      {/* ── Body (dos columnas) ──────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "12px",
          padding: "12px",
        }}
      >
        {/* ── Panel izquierdo ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 overflow-y-auto min-h-0">

          {/* Card 1 — Identidad */}
          <div className="rounded-lg border border-border bg-card p-4 shrink-0">
            <h1 className="text-base font-bold text-foreground leading-snug">{nombreCorto}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[clase, fondo.tipo_fondo].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3">
              <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground border border-border">
                {fondo.sociedad_gerente || "—"}
              </span>
            </div>
          </div>

          {/* Card 2 — Métricas clave */}
          <div className="rounded-lg border border-border bg-card p-4 shrink-0">
            <div className="mb-3">
              <span className="text-xl font-bold font-mono text-primary">
                {formatearMoneda(fondo.valor_cuotaparte, fondo.moneda)}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cuotaparte al {formatearFecha(fondo.fecha_valor)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MetaItem
                label="Moneda"
                value={
                  <Badge className={cn(monedaBadgeClass(fondo.moneda), "text-[10px]")}>
                    {fondo.moneda}
                  </Badge>
                }
              />
              <MetaItem label="Tipo" value={fondo.tipo_fondo} />
              <MetaItem
                label="Soc. Depositaria"
                value={
                  <span className="text-xs leading-tight">
                    {fondo.sociedad_depositaria || "—"}
                  </span>
                }
              />
              <MetaItem label="Fuente" value={fondo.fuente_dato} />
            </div>
          </div>

          {/* Card 3 — Documentos */}
          <div className="rounded-lg border border-border bg-card p-4 flex-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Documentos
            </p>
            <div className="divide-y divide-border/50">
              <LinkItem
                href={fondo.link_cnv}
                label="Ficha en CNV"
                icon={<ExternalLink className="h-4 w-4 text-primary" />}
              />
              <LinkItem
                href={fondo.link_reglamento}
                label="Reglamento de gestión"
                icon={<FileText className="h-4 w-4 text-amber-600" />}
              />
              <LinkItem
                href={fondo.link_composicion}
                label="Composición de cartera PDF"
                icon={<PieChartIcon className="h-4 w-4 text-violet-600" />}
              />
            </div>
          </div>

        </div>

        {/* ── Panel derecho ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 min-h-0 overflow-hidden">

          {/* Header sección */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-foreground">Composición de cartera</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{composicionLabel}</p>
            </div>
            {/* Toggle vista */}
            {tieneComposicion && (
              <div className="flex items-center rounded-lg bg-muted p-0.5 gap-0.5">
                {(["barras", "torta", "tabla"] as Vista[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                      vista === v
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === "barras" ? "Barras" : v === "torta" ? "Torta" : "Tabla"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Body composición */}
          <div className="rounded-lg border border-border bg-card p-5 flex-1 overflow-hidden flex flex-col min-h-0">
            {!tieneComposicion ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                <PieChartIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay datos de composición disponibles para este fondo.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0">
                {vista === "barras" && <VistaBarras items={items} />}
                {vista === "torta" && <VistaTorta items={items} />}
                {vista === "tabla" && <VistaTabla items={items} />}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="shrink-0 text-xs text-muted-foreground text-right">
            ID: {fondo.id} · Fuente: {fondo.fuente_dato}
          </p>

        </div>
      </div>
    </div>
  );
}
