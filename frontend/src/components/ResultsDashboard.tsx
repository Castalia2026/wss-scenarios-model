import React, { useEffect, useMemo, useState } from 'react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, ResponsiveContainer, Label,
} from 'recharts';
import { C } from '../chartColors';
import { linesFirstLegend } from './chartLegend';
import ExportButtons from './ExportButtons';

// ── formatting helpers (mirrors LiveBAUChart) ──────────────────────────────────────────────────
function round3(v: number): number { return (!isFinite(v) || v === 0) ? 0 : Number(v.toPrecision(3)); }
function sig3(v: number): string { return round3(v).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
// Money is carried in MILLIONS; show as BILLIONS (÷1000) so a 254,000 M gap reads "254 B".
function sigB(vMillions: number): string { return sig3(vMillions / 1000); }

// Period buckets for the investment tables (mirrors the presentation: 2026–2030, 2031–2040, total).
function buildPeriods(years: number[], baseYr: number): { label: string; lo: number; hi: number }[] {
  const first = baseYr + 1;                               // first forecast year (e.g. 2026)
  const end = years[years.length - 1];
  const mid = Math.min(2030, end);
  const ps = [{ label: `${first}–${mid}`, lo: first, hi: mid }];
  if (end > mid) ps.push({ label: `${mid + 1}–${end}`, lo: mid + 1, hi: end });
  ps.push({ label: `Total ${first}–${end}`, lo: first, hi: end });
  return ps;
}
const sumRange = (arr: number[], years: number[], lo: number, hi: number) =>
  years.reduce((a, y, i) => a + (y >= lo && y <= hi ? (arr[i] || 0) : 0), 0);

// ── intervention lists (key → label; resourceKey names the scenario cash stream it mobilises, if any) ──
type IntvDef = { key: string; label: string; resourceKey?: string };
const WATER_INTV: IntvDef[] = [
  { key: 'ws_collection_efficiency_enabled', label: 'Increased collection efficiency', resourceKey: 'scenario_collection_cash' },
  { key: 'ws_nrw_enabled', label: 'NRW reduction', resourceKey: 'scenario_nrw_net' },
  { key: 'ws_capital_efficiency_enabled', label: 'Budget execution improvement' },
  { key: 'ws_costeff_enabled', label: 'Capex efficiency (unit cost)' },
  { key: 'ws_techmix_enabled', label: 'Optimised technology selection' },
  { key: 'ws_tariff_enabled', label: 'Tariff reform', resourceKey: 'scenario_tariff_cash' },
  { key: 'ws_microfinance_enabled', label: 'Microfinance', resourceKey: 'scenario_mf_loan_volume' },
];
const SAN_INTV: IntvDef[] = [
  { key: 'san_collection_efficiency_enabled', label: 'Increased collection efficiency', resourceKey: 'scenario_collection_cash' },
  { key: 'san_capital_efficiency_enabled', label: 'Budget execution improvement' },
  { key: 'san_costeff_enabled', label: 'Capex efficiency (unit cost)' },
  { key: 'san_techmix_enabled', label: 'Optimised technology selection' },
  { key: 'san_nrw_link_enabled', label: 'NRW-linked sanitation revenue', resourceKey: 'scenario_nrw_link_cash' },
  { key: 'san_tariff_enabled', label: 'Tariff reform', resourceKey: 'scenario_tariff_cash' },
  { key: 'san_microfinance_enabled', label: 'Microfinance', resourceKey: 'scenario_mf_loan_volume' },
];

interface Props {
  geoScope: 'urban' | 'rural' | 'urban_rural' | 'national';
  scenarios: { name: string; inputs: any }[];
  inputs: any;
  altInputs?: Record<string, any>;
  onToggle?: (key: string, value: boolean) => void;
}

type InvTable = { periods: { label: string; lo: number; hi: number }[]; rows: { label: string; vals: number[]; strong?: boolean }[] };
type Series = { cov: any[]; gap: any[]; sum: any; inv: InvTable; unit: { sm: number; basic: number } };
type Both = { water: Series; sanitation: Series } | null;
type Row = { key: string; label: string; addHH: number; resources: number | null };

// A "fan" chart: a shaded band (dataKey "fan" = [low, high]) that widens over the forecast between the
// BAU projection and the with-interventions scenario, with reference lines traced on top.
function FanChart({ title, subtitle, data, yLabel, fanFill, fanName, lines, fmt, domain }: {
  title: string; subtitle?: string; data: any[]; yLabel: string; fanFill: string; fanName: string;
  lines: { key: string; name: string; color: string; dash?: string; width?: number }[];
  fmt: (v: number) => string; domain?: [number, number];
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f', margin: '0 0 1px' }}>{title}</h4>
      {subtitle && <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 5 }}>{subtitle}</div>}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 24, bottom: 5, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={domain} tickFormatter={fmt}>
            <Label value={yLabel} angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(v: any) => (Array.isArray(v) ? `${fmt(+v[0])} – ${fmt(+v[1])}` : fmt(+v)) as any}
            labelFormatter={(l: any) => String(l)} contentStyle={{ fontSize: 11 }} />
          {/* Legend lists the reference lines first, then the fan area (see chartLegend); render order
              (area then lines) is unchanged so the lines still draw over the band. */}
          <Legend wrapperStyle={{ fontSize: 10 }} content={linesFirstLegend} />
          <Area type="monotone" dataKey="fan" name={fanName} fill={fanFill} stroke="none" fillOpacity={0.4} legendType="rect" isAnimationActive={false} />
          {lines.map(l => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.width ?? 2}
              strokeDasharray={l.dash} dot={false} legendType="plainline" connectNulls isAnimationActive={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ResultsDashboard({ geoScope, scenarios, inputs, altInputs, onToggle }: Props) {
  const [viewScope, setViewScope] = useState<'urban' | 'rural' | 'national'>(
    geoScope === 'urban' ? 'urban' : geoScope === 'rural' ? 'rural' : 'national'
  );
  const [unitMode, setUnitMode] = useState<'count' | 'share'>('count');
  const [both, setBoth] = useState<Both>(null);
  const [table, setTable] = useState<{ water: Row[]; sanitation: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datasets for the chosen scope (national = urban + rural summed, when rural data exists).
  const datasets = useMemo(() => {
    const rural = altInputs?.['rural'];
    if (viewScope === 'urban') return [inputs];
    if (viewScope === 'rural') return [rural ?? inputs];
    return rural ? [inputs, rural] : [inputs];        // national
  }, [inputs, altInputs, viewScope]);

  const cur = datasets[0]?.country_config?.currency || 'LCU';
  const toggles = inputs?.toggles || {};
  const depKey = JSON.stringify(datasets);

  // ── Fan charts: BAU vs the user's full designed scenario (interventions + customs) ──────────────
  useEffect(() => {
    if (!datasets.length || !datasets[0]) return;
    const h = setTimeout(() => {
      Promise.all(datasets.map((inp: any) =>
        fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inp) })
          .then(r => { if (!r.ok) throw new Error('calc failed (' + r.status + ')'); return r.json(); })
      )).then(resList => {
        const years: number[] = resList[0].years;
        const per = datasets[0]?.period || {};
        const baseYr = per.baseline_year ?? years[0];
        const endIdx = years.length - 1;
        const sum = (pick: (res: any, i: number) => number) =>
          years.map((_: number, i: number) => resList.reduce((a, res) => a + (pick(res, i) || 0), 0));
        const totalHH = years.map((_, i) => resList.reduce((a, res) => a + (res.total_hh[i] || 0), 0));
        const build = (secKey: 'water_supply' | 'sanitation'): Series => {
          const secOf = (res: any) => res[secKey];
          const bau = sum((r, i) => secOf(r).bau_hh[0][i]);
          const scn = sum((r, i) => secOf(r).scenario_hh[0][i]);
          const tgt = sum((r, i) => secOf(r).target_hh[0][i]);
          const bauGap = sum((r, i) => (secOf(r).financing_gap || [])[i] || 0);
          const scnGap = sum((r, i) => (secOf(r).scenario_financing_gap || [])[i] || 0);
          const cov = years.map((y, i) => {
            const tot = totalHH[i];
            const b = Math.min(tot, bau[i]), s = Math.min(tot, scn[i]), t = Math.min(tot, tgt[i]);
            return { year: y, total: +tot.toFixed(4), bau: +b.toFixed(4), scn: +s.toFixed(4), tgt: +t.toFixed(4),
              fan: [+Math.min(b, s).toFixed(4), +Math.max(b, s).toFixed(4)] as [number, number] };
          });
          const gap = years.map((y, i) => {
            const b = bauGap[i] || 0, s = scnGap[i] || 0;
            return { year: y, bauGap: b, scnGap: s, fan: [Math.min(b, s), Math.max(b, s)] as [number, number] };
          });
          const tEnd = totalHH[endIdx] || 0;
          const covPct = (a: number[]) => tEnd > 0 ? Math.min(tEnd, a[endIdx]) / tEnd : 0;
          const cumGap = (a: number[]) => years.reduce((s2, y, i) => s2 + (y > baseYr ? (a[i] || 0) : 0), 0);
          // Current (baseline-year) safely-managed coverage — BAU at the baseline = the actual.
          const baseIdx = Math.max(0, years.indexOf(baseYr));
          const tBase = totalHH[baseIdx] || 0;
          const curCov = tBase > 0 ? Math.min(tBase, bau[baseIdx]) / tBase : 0;
          // Investment-gap table (BAU basis): annual flows summed over each period, millions → billions.
          const newCap = sum((r, i) => secOf(r).new_capex_total?.[i] || 0);
          const repl = sum((r, i) => secOf(r).replacement_capex?.[i] || 0);
          const totNeed = sum((r, i) => secOf(r).total_investment_need?.[i] || 0);
          const bauInv = sum((r, i) => secOf(r).bau_available?.[i] || 0);
          const periods = buildPeriods(years, baseYr);
          const invRow = (label: string, arr: number[], strong = false) =>
            ({ label, strong, vals: periods.map(p => sumRange(arr, years, p.lo, p.hi) / 1000) });
          const inv: InvTable = { periods, rows: [
            invRow('Investment for new households (A)', newCap),
            invRow('Replacement capex (B)', repl),
            invRow('Total investment need (C = A + B)', totNeed, true),
            invRow('BAU investment (D)', bauInv),
            invRow('Financing gap (C − D)', bauGap, true),
          ] };
          const unit = { sm: secOf(resList[0]).cost_per_hh || 0, basic: secOf(resList[0]).cost_basic || 0 };
          return { cov, gap, inv, unit, sum: {
            endline: years[endIdx], curCov, bauCov: covPct(bau), scnCov: covPct(scn), tgtCov: covPct(tgt),
            addHH: Math.max(0, Math.min(tEnd, scn[endIdx]) - Math.min(tEnd, bau[endIdx])),
            gapBauCum: cumGap(bauGap), gapScnCum: cumGap(scnGap),
          } };
        };
        setBoth({ water: build('water_supply'), sanitation: build('sanitation') });
        setError(null);
      }).catch(e => setError(String(e)));
    }, 350);
    return () => clearTimeout(h);
  }, [depKey]);

  // ── Per-intervention table: cumulative passes over the ENABLED built-in toggles isolate each lever's
  //    marginal safely-managed households (Δ scenario_hh) and its mobilised resources (Δ its cash stream).
  //    Customs are excluded from this itemisation (they still feed the fan above). ─────────────────────
  useEffect(() => {
    if (!datasets.length || !datasets[0]) { setTable(null); return; }
    const enW = WATER_INTV.filter(d => toggles[d.key]);
    const enS = SAN_INTV.filter(d => toggles[d.key]);
    const enabled = [...enW, ...enS];
    if (!enabled.length) { setTable({ water: [], sanitation: [] }); return; }
    const h = setTimeout(() => {
      const off = Object.fromEntries(Object.keys(toggles).map(k => [k, false]));
      const sets: any[] = [{ ...off }];                                  // pass 0 = BAU (all off)
      let acc: any = { ...off };
      enabled.forEach(d => { acc = { ...acc, [d.key]: true }; sets.push({ ...acc }); });
      const fetchPass = (tg: any) => Promise.all(datasets.map((inp: any) =>
        fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...inp, toggles: tg, custom_interventions: [] }) }).then(r => r.json())));
      Promise.all(sets.map(fetchPass)).then(passes => {           // passes[p] = results[] (one per dataset)
        const years: number[] = passes[0][0].years;
        const per = datasets[0]?.period || {};
        const baseYr = per.baseline_year ?? years[0];
        const endIdx = years.length - 1;
        const smEnd = (rl: any[], sk: string) => rl.reduce((a, r) => a + (r[sk].scenario_hh[0][endIdx] || 0), 0);
        const cashCum = (rl: any[], sk: string, f: string) => rl.reduce((a, r) =>
          a + (r[sk][f] || []).reduce((s: number, v: number, i: number) => s + (years[i] > baseYr ? (v || 0) : 0), 0), 0);
        const rowsFor = (defs: IntvDef[], sk: string): Row[] => defs.map(d => {
          const idx = enabled.findIndex(e => e.key === d.key);       // position in the cumulative sequence
          const after = passes[idx + 1], before = passes[idx];
          const addHH = Math.max(0, smEnd(after, sk) - smEnd(before, sk)) * 1000;      // millions HH → thousands
          const resources = d.resourceKey
            ? (cashCum(after, sk, d.resourceKey) - cashCum(before, sk, d.resourceKey)) / 1000               // M → B
            : null;
          return { key: d.key, label: d.label, addHH, resources };
        });
        setTable({ water: rowsFor(enW, 'water_supply'), sanitation: rowsFor(enS, 'sanitation') });
      }).catch(() => { /* leave the previous table on a transient fetch error */ });
    }, 400);
    return () => clearTimeout(h);
  }, [depKey, JSON.stringify(toggles)]);

  const isShare = unitMode === 'share';
  const covFmt = isShare ? (v: number) => Math.round(v * 100) + '%' : (v: number) => sig3(v);
  const gapFmt = (v: number) => sigB(v);
  const asShare = (rows: any[]) => rows.map(r => {
    const tot = r.total || 0; const d = (v: number) => tot > 0 ? v / tot : 0;
    return { year: r.year, total: tot > 0 ? 1 : 0, bau: d(r.bau), scn: d(r.scn), tgt: d(r.tgt), fan: [d(r.fan[0]), d(r.fan[1])] };
  });

  const scopeName = viewScope === 'rural' ? 'Rural' : viewScope === 'urban' ? 'Urban' : 'National';
  const pct = (f: number) => (f * 100).toFixed(1) + '%';

  // ── Resources-and-households table (per sector) ────────────────────────────────────────────────
  const ImpactTable = ({ rows, hhCol }: { rows: Row[]; hhCol: string }) => {
    if (!rows || !rows.length) return null;
    const totRes = rows.reduce((a, r) => a + (r.resources || 0), 0);
    const totHH = rows.reduce((a, r) => a + (r.addHH || 0), 0);
    const th: React.CSSProperties = { padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#0ea5e9', textAlign: 'right' };
    const td: React.CSSProperties = { padding: '6px 12px', fontSize: 11.5, borderBottom: '1px solid #eef2f7', textAlign: 'right' };
    return (
      <div style={{ margin: '2px 0 4px', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, maxWidth: 680 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Intervention</th>
              <th style={th}>Resources generated ({cur} b)</th>
              <th style={th}>{hhCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} style={{ background: i % 2 ? '#f1f8fd' : '#fff' }}>
                <td style={{ ...td, textAlign: 'left', color: '#334155' }}>{r.label}</td>
                <td style={{ ...td, color: '#0369a1' }}>{r.resources == null ? '—' : sig3(r.resources)}</td>
                <td style={{ ...td, color: '#0369a1' }}>{sig3(r.addHH)}</td>
              </tr>
            ))}
            <tr style={{ background: '#dff1fb', fontWeight: 700 }}>
              <td style={{ ...td, textAlign: 'left', color: '#1e3a5f', borderBottom: 'none' }}>Total</td>
              <td style={{ ...td, color: '#1e3a5f', borderBottom: 'none' }}>{sig3(totRes)}</td>
              <td style={{ ...td, color: '#1e3a5f', borderBottom: 'none' }}>{sig3(totHH)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ── Table 9: Executive summary — SM coverage now vs BAU / target / with-reforms at the endline ──
  const ExecSummary = () => {
    if (!both) return null;
    const end = both.water.sum.endline;
    const th: React.CSSProperties = { padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#0ea5e9', textAlign: 'right' };
    const td: React.CSSProperties = { padding: '6px 12px', fontSize: 11.5, borderBottom: '1px solid #eef2f7', textAlign: 'right' };
    const rows: [string, any][] = [['Water Supply', both.water.sum], ['Sanitation', both.sanitation.sum]];
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>Executive summary — safely-managed coverage (% of households)</div>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, maxWidth: 720 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}>Sector · {scopeName}</th>
              <th style={th}>Current</th><th style={th}>BAU {end}</th><th style={th}>Target {end}</th><th style={th}>With reforms {end}</th>
            </tr></thead>
            <tbody>
              {rows.map(([label, s], i) => (
                <tr key={label} style={{ background: i % 2 ? '#f1f8fd' : '#fff' }}>
                  <td style={{ ...td, textAlign: 'left', color: '#334155', fontWeight: 600 }}>{label}</td>
                  <td style={{ ...td, color: '#475569' }}>{pct(s.curCov)}</td>
                  <td style={{ ...td, color: C.bau }}>{pct(s.bauCov)}</td>
                  <td style={{ ...td, color: C.target }}>{pct(s.tgtCov)}</td>
                  <td style={{ ...td, color: C.scenario, fontWeight: 700 }}>{pct(s.scnCov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Table 3: Investment gap (BAU basis), by period. ── & Table 5: Unit costs. ───────────────────
  const InvestmentGapTable = ({ inv }: { inv: InvTable }) => {
    const th: React.CSSProperties = { padding: '6px 10px', fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#0369a1', textAlign: 'right' };
    const td: React.CSSProperties = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid #eef2f7', textAlign: 'right' };
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 3 }}>Investment gap (BAU, {cur} b)</div>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left' }}> </th>
              {inv.periods.map(p => <th key={p.label} style={th}>{p.label}</th>)}
            </tr></thead>
            <tbody>
              {inv.rows.map((r, i) => (
                <tr key={r.label} style={{ background: r.strong ? '#eef6fb' : i % 2 ? '#f8fbfd' : '#fff', fontWeight: r.strong ? 700 : 400 }}>
                  <td style={{ ...td, textAlign: 'left', color: r.strong ? '#1e3a5f' : '#334155' }}>{r.label}</td>
                  {r.vals.map((v, j) => <td key={j} style={{ ...td, color: r.strong ? '#1e3a5f' : '#0369a1' }}>{sig3(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const UnitCostTable = ({ unit }: { unit: { sm: number; basic: number } }) => {
    const td: React.CSSProperties = { padding: '5px 10px', fontSize: 11, borderBottom: '1px solid #eef2f7', textAlign: 'right' };
    const avg = (unit.sm + unit.basic) / 2;
    const rows: [string, number][] = [
      ['Safely-managed service', unit.sm],
      ['Basic service', unit.basic],
      ['Average capex per HH', avg],
    ];
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 3 }}>Unit cost per household ({cur})</div>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, maxWidth: 420 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {rows.map(([label, v], i) => (
                <tr key={label} style={{ background: i === 2 ? '#eef6fb' : i % 2 ? '#f8fbfd' : '#fff', fontWeight: i === 2 ? 700 : 400 }}>
                  <td style={{ ...td, textAlign: 'left', color: '#334155' }}>{label}</td>
                  <td style={{ ...td, color: '#0369a1' }}>{Math.round(v).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>Unit costs shown for the selected geographic scope ({scopeName}).</div>
      </div>
    );
  };

  const sectorBlock = (secKey: 'water' | 'sanitation') => {
    if (!both) return null;
    const s = secKey === 'water' ? both.water : both.sanitation;
    const label = secKey === 'water' ? 'Water Supply' : 'Sanitation';
    const covRows = isShare ? asShare(s.cov) : s.cov;
    // Tool-wide colour convention (see chartColors): BLUE = BAU, GREEN = target, ORANGE = with interventions.
    // Order matters — later lines draw on top. Total (grey ceiling) first, then BAU, interventions, and
    // Target LAST so the green target line is never hidden behind the grey ceiling where they coincide.
    const covLines = [
      { key: 'total', name: 'Total households', color: C.total, dash: '8 4', width: 1.25 },
      { key: 'bau', name: 'BAU', color: C.bau, width: 2 },
      { key: 'scn', name: 'With interventions', color: C.scenario, width: 2.5 },
      { key: 'tgt', name: 'Target', color: C.target, dash: '6 3', width: 2 },
    ];
    const gapLines = [
      { key: 'bauGap', name: 'BAU financing gap', color: C.bau, width: 2.5 },
      { key: 'scnGap', name: 'With interventions', color: C.scenario, width: 2.5 },
    ];
    const noFan = s.sum.addHH < 1e-4 && Math.abs(s.sum.gapBauCum - s.sum.gapScnCum) < 1e-4;
    const rows = secKey === 'water' ? table?.water : table?.sanitation;
    const hhCol = secKey === 'water' ? "Added HHs with treated, piped (HHs '000)" : "Added safely-managed HHs (HHs '000)";
    return (
      <div key={secKey} style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid #e2e8f0', paddingBottom: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>· {scopeName}</span>
        </div>
        <div style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #0ea5e9', borderRadius: 6, padding: '8px 12px', lineHeight: 1.55, marginBottom: 12 }}>
          <b>By {s.sum.endline}</b>, safely-managed coverage increases from <b>{pct(s.sum.bauCov)}</b> (BAU) to <b>{pct(s.sum.scnCov)}</b> with the current interventions — <b>{sig3(s.sum.addHH)} M</b> more households — against a target of <b>{pct(s.sum.tgtCov)}</b>. The cumulative financing gap narrows from <b>{sigB(s.sum.gapBauCum)}</b> to <b>{sigB(s.sum.gapScnCum)} B {cur}</b>.
        </div>
        {noFan && (
          <div style={{ fontSize: 10.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '5px 9px', marginBottom: 10 }}>
            No interventions are active for {label.toLowerCase()}. Toggle some on above to open the fan and fill the table.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 8 }}>
          <FanChart title={`${label} — safely-managed coverage`} subtitle="Blue = BAU · orange = with interventions · green = target"
            data={covRows} yLabel={isShare ? '% of population' : '# households (millions)'}
            fanFill={C.range} fanName="BAU → interventions range" lines={covLines} fmt={covFmt} domain={isShare ? [0, 1] : undefined} />
          <FanChart title={`${label} — annual financing gap`} subtitle="Blue = BAU · orange = with interventions"
            data={s.gap} yLabel={`Financing gap (B ${cur}/yr)`}
            fanFill={C.range} fanName="Gap closed by interventions" lines={gapLines} fmt={gapFmt} />
        </div>
        {rows && rows.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 3 }}>Contribution by intervention (cumulative to {s.sum.endline})</div>
            <ImpactTable rows={rows} hhCol={hhCol} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12, alignItems: 'start' }}>
          <InvestmentGapTable inv={s.inv} />
          <UnitCostTable unit={s.unit} />
        </div>
      </div>
    );
  };

  // ── Intervention on/off toggle bar (details live on the Intervention Design tab) ─────────────────
  const ToggleColumn = ({ title, defs }: { title: string; defs: IntvDef[] }) => (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1e3a5f', marginBottom: 5 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {defs.map(d => {
          const on = !!toggles[d.key];
          return (
            <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, cursor: 'pointer',
              padding: '4px 8px', background: on ? '#eff6ff' : '#fff', border: `1px solid ${on ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 5 }}>
              <input type="checkbox" checked={on} onChange={e => onToggle?.(d.key, e.target.checked)}
                style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
              <span style={{ color: on ? '#1e3a5f' : '#475569', fontWeight: on ? 600 : 400 }}>{d.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 17, color: '#1e3a5f', margin: 0 }}>Results — intervention impact (live)</h2>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Fan charts show the range from business-as-usual to your designed intervention scenario, widening over the forecast.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Scope</span>
            <select value={viewScope} onChange={e => setViewScope(e.target.value as any)}
              style={{ padding: '5px 26px 5px 8px', borderRadius: 5, border: '1px solid #94a3b8', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
              <option value="urban">Urban</option>
              <option value="rural">Rural</option>
              <option value="national">National</option>
            </select>
          </div>
          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            {([['count', '# Households'], ['share', '% of population']] as const).map(([m, l]) => (
              <button key={m} onClick={() => setUnitMode(m)} style={{
                padding: '5px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: unitMode === m ? '#2563eb' : '#fff', color: unitMode === m ? '#fff' : '#475569',
                fontWeight: unitMode === m ? 700 : 500,
              }}>{l}</button>
            ))}
          </div>
          <ExportButtons inputs={inputs} />
        </div>
      </div>

      {/* Intervention on/off toggles — parameters are set on the Intervention Design tab. */}
      <div style={{ border: '1px solid #c7d2fe', background: '#f5f7ff', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#312e81' }}>Interventions</span>
          <span style={{ fontSize: 10.5, color: '#64748b' }}>Switch each on or off — set its parameters on the <b>Intervention Design</b> tab.</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <ToggleColumn title="Water Supply" defs={WATER_INTV} />
          <ToggleColumn title="Sanitation" defs={SAN_INTV} />
        </div>
      </div>

      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {!both && !error && <div style={{ fontSize: 12, color: '#64748b', padding: '20px 0' }}>Computing…</div>}

      {/* Executive summary (table 9) — headline coverage, results-first. */}
      <ExecSummary />

      {sectorBlock('water')}
      {sectorBlock('sanitation')}

      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: -6, marginBottom: 16 }}>
        Table: “Resources generated” is the finance each lever mobilises (revenue collected, tariff income, recovered-water
        value, sewer revenue, or loans) — cost-side and budget-execution levers show “—” as they stretch existing budget
        rather than raise new money. “Added HHs” is each lever’s marginal safely-managed service. Custom interventions
        feed the fan charts but are not itemised here.
      </div>

      {scenarios.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>Saved scenarios</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {scenarios.map((sc, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', background: '#f8fafc' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', marginBottom: 4 }}>{sc.name}</div>
                <button onClick={() => {
                  fetch('/api/export/pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sc.inputs) })
                    .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${sc.name}.pptx`; a.click(); });
                }} style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  📑 Export slide
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
