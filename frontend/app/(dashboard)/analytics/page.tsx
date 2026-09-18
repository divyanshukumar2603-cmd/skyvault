'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingDown, Table2, Target, Layers } from 'lucide-react';
import { analyticsApi } from '@/lib/api';

/**
 * Categorical series palette, validated against the dark chart surface
 * (#14141a): lightness band, chroma floor, CVD separation (worst adjacent
 * ΔE 12.6), normal-vision separation (20.3) and ≥3:1 contrast all pass.
 * Colour is never the only channel — every series is also direct-labelled.
 */
const SERIES = [
  { key: 'VIEW', label: 'Views', color: '#8b5cf6' },
  { key: 'CLICK', label: 'Clicks', color: '#0891b2' },
  { key: 'CART', label: 'Cart adds', color: '#d97706' },
  { key: 'PURCHASE', label: 'Purchases', color: '#db2777' },
];

/** Funnel stages are ordered, so they take one hue stepped by depth, not four hues. */
const FUNNEL_RAMP = ['#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (n: number) => n.toLocaleString('en-US');

function Card({ title, icon, children, note }: { title: string; icon?: React.ReactNode; children: React.ReactNode; note?: string }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {note && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{note}</p>}
      {!note && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

/** Headline numbers belong in stat tiles, not in a one-bar chart. */
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Funnel({ stages }: { stages: any[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const labels: Record<string, string> = { VIEW: 'Views', CLICK: 'Clicks', CART: 'Cart adds', PURCHASE: 'Purchases' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {stages.map((s, i) => (
        <div key={s.stage}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{labels[s.stage]}</span>
            <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {compact(s.count)}
              {i > 0 && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                  {pct(s.stepConversion)} of step above
                </span>
              )}
            </span>
          </div>
          <div style={{ height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              title={`${labels[s.stage]}: ${compact(s.count)} (${pct(s.overallConversion)} of views)`}
              style={{
                width: `${(s.count / max) * 100}%`,
                height: '100%',
                background: FUNNEL_RAMP[i],
                borderRadius: '0 4px 4px 0',
                minWidth: s.count > 0 ? 3 : 0,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Multi-series daily trend with a crosshair and shared tooltip. */
function TrendChart({ series }: { series: Record<string, { day: string; count: number }[]> }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const days = series[SERIES[0].key]?.map((d) => d.day) ?? [];
  const W = 760, H = 220, PAD_L = 38, PAD_R = 58, PAD_T = 14, PAD_B = 26;

  const max = useMemo(() => {
    const all = SERIES.flatMap((s) => (series[s.key] ?? []).map((d) => d.count));
    return Math.max(1, ...all);
  }, [series]);

  if (days.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activity in this window.</p>;

  const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, days.length - 1);
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);

  function handleMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_L) / (W - PAD_L - PAD_R)) * (days.length - 1));
    setHover(Math.min(Math.max(i, 0), days.length - 1));
  }

  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  // Series ending at similar values would print their labels on top of each
  // other, so nudge them apart while keeping their vertical order.
  const labelPositions = (() => {
    const MIN_GAP = 12;
    const raw = SERIES.map((s, i) => {
      const data = series[s.key] ?? [];
      return { i, y: y(data[data.length - 1]?.count ?? 0) };
    }).sort((a, b) => a.y - b.y);

    for (let k = 1; k < raw.length; k++) {
      if (raw[k].y - raw[k - 1].y < MIN_GAP) raw[k].y = raw[k - 1].y + MIN_GAP;
    }
    // Keep the stack inside the plot area if pushing down overflowed it.
    const overflow = raw[raw.length - 1].y - (H - PAD_B);
    if (overflow > 0) for (const r of raw) r.y -= overflow;

    const out: number[] = [];
    for (const r of raw) out[r.i] = r.y;
    return out;
  })();

  return (
    <div>
      {/* Legend — always present for multiple series */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        {SERIES.map((s) => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
        <button onClick={() => setShowTable((v) => !v)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Table2 size={11} /> {showTable ? 'hide data' : 'view as table'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 520, display: 'block' }}
          onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
          {/* Recessive gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{t}</text>
            </g>
          ))}

          {/* Date axis — first, middle and last only, to avoid label collisions */}
          {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {days[i]?.slice(5)}
            </text>
          ))}

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={H - PAD_B} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          )}

          {SERIES.map((s, si) => {
            const data = series[s.key] ?? [];
            const points = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
            const last = data[data.length - 1];
            const labelY = labelPositions[si];
            return (
              <g key={s.key}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {/* Direct label at the series end — identity never rests on colour alone.
                    A leader line connects it back when decluttering moved it off the line. */}
                <line x1={W - PAD_R} y1={y(last?.count ?? 0)} x2={W - PAD_R + 4} y2={labelY - 3}
                  stroke={s.color} strokeWidth={1} opacity={0.5} />
                <text x={W - PAD_R + 6} y={labelY} fontSize={10} fill="var(--text-secondary)">
                  {s.label}
                </text>
                {hover !== null && (
                  <circle cx={x(hover)} cy={y(data[hover]?.count ?? 0)} r={4.5} fill={s.color}
                    stroke="#14141a" strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hover !== null && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{days[hover]}</strong>
          {SERIES.map((s) => (
            <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              {s.label}: <strong style={{ color: 'var(--text-primary)' }}>{series[s.key]?.[hover]?.count ?? 0}</strong>
            </span>
          ))}
        </div>
      )}

      {showTable && (
        <div style={{ marginTop: 12, overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Day</th>
                {SERIES.map((s) => <th key={s.key} style={{ padding: '6px 8px', textAlign: 'right' }}>{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr key={day} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{day}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {series[s.key]?.[i]?.count ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.dashboard(days);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: 32, color: '#f87171' }}>Failed to load analytics: {error}</div>;
  }

  const { overview, funnel, topProducts, categories, trend, effectiveness } = data;
  const maxCategoryInteractions = Math.max(1, ...categories.map((c: any) => c.interactions));
  const maxProductWeight = Math.max(1, ...topProducts.map((p: any) => p.weighted));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={22} color="var(--accent-violet)" /> Commerce Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13, maxWidth: 640 }}>
            Behavioural analytics across the catalogue: how shoppers move through the funnel,
            which categories perform, and whether the ranking engine surfaces what people buy.
          </p>
        </div>
        {/* Time-range filter sits in one row above the charts */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`badge ${days === d ? 'badge-violet' : ''}`}
              style={{ cursor: 'pointer', border: '1px solid var(--border)', background: days === d ? undefined : 'transparent' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gap: 12, marginTop: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatTile label="Revenue" value={money(funnel.revenue)} sub={`${compact(funnel.orders)} orders`} />
        <StatTile label="Avg order value" value={money(funnel.averageOrderValue)} />
        <StatTile label="Interactions" value={compact(overview.engagement.interactions)} sub={`last ${days} days`} />
        <StatTile label="Active shoppers" value={compact(overview.audience.activeShoppers)} sub={`${compact(overview.audience.shoppersWithHistory)} with history`} />
        <StatTile label="View → purchase" value={pct(funnel.stages[3]?.overallConversion ?? 0)} />
        <StatTile label="Catalogue reach" value={pct(effectiveness.catalogueCoverage)} sub={`${overview.catalogue.products} products`} />
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card title="Conversion funnel" icon={<TrendingDown size={15} color="var(--text-muted)" />}
          note={`How ${compact(funnel.stages[0]?.count ?? 0)} product views converted through to purchase`}>
          <Funnel stages={funnel.stages} />
        </Card>

        <Card title="Ranking effectiveness" icon={<Target size={15} color="var(--text-muted)" />}
          note="Mean position at which each action occurred. Purchases happening at a lower mean rank than views means the ordering is working.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SERIES.map((s) => {
              const v = effectiveness.meanRankByType[s.key];
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {v === null ? '—' : `rank ${v.toFixed(1)}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Top-5 concentration</span>
              <strong style={{ color: 'var(--text-primary)' }}>{pct(effectiveness.top5Concentration)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Interactions with a recorded position</span>
              <strong style={{ color: 'var(--text-primary)' }}>{pct(effectiveness.measuredShare)}</strong>
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Seeded demo activity carries no position, so mean rank reflects real interface use only.
            </p>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Daily engagement" icon={<Layers size={15} color="var(--text-muted)" />}
          note="Interactions per day by signal type. Hover for exact values.">
          <TrendChart series={trend.series} />
        </Card>
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card title="Category performance" note="Ordered by total engagement">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {categories.map((c: any) => (
              <div key={c.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.category}</span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {compact(c.interactions)} signals · {c.purchases} sold · {money(c.revenue)}
                  </span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div title={`${c.category}: ${c.interactions} interactions`}
                    style={{ width: `${(c.interactions / maxCategoryInteractions) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: '0 4px 4px 0' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top products" note="By time-decayed weighted engagement">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', fontSize: 11 }}>
                  <th style={{ padding: '6px 6px 6px 0' }}>Product</th>
                  <th style={{ padding: 6, textAlign: 'right' }}>Sold</th>
                  <th style={{ padding: 6, textAlign: 'right' }}>Revenue</th>
                  <th style={{ padding: '6px 0 6px 6px', width: 90 }}>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p: any) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 6px 8px 0' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{p.category} · {p.brand}</div>
                    </td>
                    <td style={{ padding: 6, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.purchases}</td>
                    <td style={{ padding: 6, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{money(p.revenue)}</td>
                    <td style={{ padding: '6px 0 6px 6px' }}>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div title={`weighted engagement ${p.weighted}`}
                          style={{ width: `${(p.weighted / maxProductWeight) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: '0 3px 3px 0' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatTile label="Files stored" value={compact(overview.storage.files)} />
        <StatTile label="Storage used" value={`${(overview.storage.bytes / 1_048_576).toFixed(1)} MB`} />
        <StatTile label="File versions" value={compact(overview.storage.versions)} />
        <StatTile label="Backup snapshots" value={compact(overview.storage.backups)} />
      </div>
    </div>
  );
}
