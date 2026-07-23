import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label,
} from 'recharts';

/**
 * Live intervention-impact chart. INCREMENTAL multi-pass compare: it POSTs /api/calculate once for the
 * pure BAU (every toggle off), then once more for each enabled intervention added CUMULATIVELY on top.
 * The marginal safely-managed households each pass adds become a STACKED band, one colour per
 * intervention, sitting on the grey BAU base — so the coloured stack is the extra coverage the enabled
 * interventions deliver, and the top of the stack is the full with-intervention scenario. Replaces the
 * old synthetic StaticCharts.InterventionImpactChart.
 */
type Intv = [key: string, label: string, color: string];   // toggle key, legend label, band colour
const WATER_INTV: Intv[] = [
  ['ws_collection_efficiency_enabled', 'Collection efficiency', '#0891b2'],
  ['ws_capital_efficiency_enabled', 'Budget execution', '#16a34a'],
  ['ws_costeff_enabled', 'Capex efficiency', '#7c3aed'],
  ['ws_techmix_enabled', 'Optimised technology', '#0d9488'],
  ['ws_nrw_enabled', 'NRW reduction', '#2563eb'],
  ['ws_tariff_enabled', 'Tariff reform', '#d97706'],
  ['ws_microfinance_enabled', 'Microfinance', '#db2777'],
];
const SAN_INTV: Intv[] = [
  ['san_collection_efficiency_enabled', 'Collection efficiency', '#0891b2'],
  ['san_capital_efficiency_enabled', 'Budget execution', '#16a34a'],
  ['san_costeff_enabled', 'Capex efficiency', '#7c3aed'],
  ['san_techmix_enabled', 'Optimised technology', '#0d9488'],
  ['san_nrw_link_enabled', 'NRW-linked revenue', '#0369a1'],
  ['san_tariff_enabled', 'Tariff reform', '#d97706'],
  ['san_microfinance_enabled', 'Microfinance', '#db2777'],
];

const zeroToggles = (t: any) => Object.fromEntries(Object.keys(t || {}).map(k => [k, false]));
const sig = (v: number) => (!isFinite(v) || v === 0) ? '0' : Number(v.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function LiveInterventionChart({ inputs, sector, scopeLabel }: {
  inputs: any; sector: 'water' | 'sanitation'; scopeLabel?: string;
}) {
  const [data, setData] = useState<any[]>([]);
  const [bands, setBands] = useState<Intv[]>([]);   // interventions that actually contribute, in stack order
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const depKey = JSON.stringify(inputs) + '|' + sector;
  useEffect(() => {
    if (!inputs) return;
    const list = sector === 'water' ? WATER_INTV : SAN_INTV;
    const enabled = list.filter(([k]) => inputs?.toggles?.[k]);
    // Enabled CUSTOM interventions that apply to this sector become trailing bands after the built-in ones.
    const enabledCustoms: any[] = (inputs?.custom_interventions || [])
      .filter((c: any) => c && c.enabled !== false && (c.sector === sector || c.sector === 'both'));
    const h = setTimeout(() => {
      const post = (body: any) => fetch('/api/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error('calc failed (' + r.status + ')'); return r.json(); });
      const secOf = (res: any) => sector === 'water' ? res.water_supply : res.sanitation;
      const off = zeroToggles(inputs?.toggles);
      // Cross-sector prerequisite: the sanitation "NRW-linked revenue" lever only has recovered water to
      // charge for when the WATER NRW lever is on, so keep ws_nrw_enabled at the user's setting in every
      // sanitation pass (it doesn't affect any of the other sanitation levers). Without this the linked
      // band would always read 0 on the sanitation chart even with water NRW switched on.
      if (sector === 'sanitation') off.ws_nrw_enabled = !!inputs?.toggles?.ws_nrw_enabled;
      // Cumulative payloads: [BAU] → +each toggle → +each custom. The baseline and toggle passes carry NO
      // customs (custom_interventions:[]) so the grey base is the pure BAU and customs show as their own
      // bands on top; customs are then added one-by-one over all toggles.
      const payloads: any[] = [{ ...inputs, toggles: off, custom_interventions: [] }];
      let acc: any = { ...off };
      enabled.forEach(([k]) => { acc = { ...acc, [k]: true }; payloads.push({ ...inputs, toggles: { ...acc }, custom_interventions: [] }); });
      let accCustoms: any[] = [];
      enabledCustoms.forEach((c: any) => { accCustoms = [...accCustoms, c]; payloads.push({ ...inputs, toggles: { ...acc }, custom_interventions: accCustoms }); });
      // Combined stack order (toggles then customs) with UNIQUE labels for the chart dataKeys.
      const bandDefs: Intv[] = [...enabled];
      const seen = new Set<string>(enabled.map(([, label]) => label));
      enabledCustoms.forEach((c: any, i: number) => {
        let label = ((c.name || '').trim()) || `Custom ${i + 1}`;
        while (seen.has(label)) label += ' ';
        seen.add(label);
        bandDefs.push([`custom_${i}`, label, c.color || '#9333ea']);
      });
      Promise.all(payloads.map(post)).then(results => {
        const years: number[] = results[0].years;
        // The engine returns a PURE BAU (`bau_hh`, invariant) plus the SCENARIO safely-managed path under
        // that pass's toggles+customs (`scenario_hh`). Grey base = pure BAU; each pass's scenario_hh gives
        // the extra SM its newly-added lever delivers (sm[p+1] − sm[p] for band p, in payload order).
        const bauBase = secOf(results[0]).bau_hh[0];                 // pure BAU (same in every pass)
        const sm = results.map((r: any) => secOf(r).scenario_hh[0]); // SM WITH the pass's levers
        const rows = years.map((y: number, i: number) => {
          const row: any = { year: +y, 'BAU (safely managed)': +(+bauBase[i]).toFixed(4), 'Total households': +(+results[0].total_hh[i]).toFixed(4) };
          bandDefs.forEach(([, label], p) => { row[label] = Math.max(0, +(sm[p + 1][i] - sm[p][i]).toFixed(4)); });
          return row;
        });
        // Only stack levers that actually move the needle (an enabled-but-unparameterised one adds 0).
        const contributing = bandDefs.filter(([, label]) => rows.some((r: any) => r[label] > 1e-4));
        setData(rows);
        setBands(contributing);
        const full = secOf(results[results.length - 1]);            // all enabled toggles + customs applied
        const bau = secOf(results[0]);
        const e = years.length - 1;
        const cum = (a: number[]) => (a || []).reduce((s: number, v: number) => s + (+v || 0), 0);
        setSummary({
          // Compare the full-scenario SM / gap against the PURE BAU (bau_hh / financing_gap).
          endline: years[e], addHH: Math.max(0, (+full.scenario_hh[0][e]) - (+bau.bau_hh[0][e])),
          gapBau: cum(bau.financing_gap), gapIntv: cum(full.scenario_financing_gap),
          cur: inputs?.country_config?.currency || 'LCU',
        });
        setError(null);
      }).catch((err: any) => setError(String(err)));
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel ? scopeLabel + ' ' : ''}{sectorLabel} — intervention impact (live)
      </h3>
      <div style={{ fontSize: 10, color: '#065f46', background: '#d1fae5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Live engine output. The grey base is business-as-usual safely-managed coverage; each coloured band stacked on top is the extra households an enabled intervention delivers.
      </div>
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {summary && (
        <div style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #16a34a', borderRadius: 6, padding: '8px 12px', lineHeight: 1.55, marginBottom: 10 }}>
          <b>Impact.</b> By {summary.endline}, the enabled interventions serve <b>{sig(summary.addHH)} M</b> more safely-managed households and cut the cumulative financing gap from <b>{sig(summary.gapBau)}</b> to <b>{sig(summary.gapIntv)} M {summary.cur}</b>
          {summary.gapBau > 0 && <> (a <b>{Math.round((1 - summary.gapIntv / summary.gapBau) * 100)}%</b> reduction)</>}.
        </div>
      )}
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 14, right: 24, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => sig(v)}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(v: any) => sig(+v) + ' M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* Grey BAU base, then one stacked band per contributing intervention. Animated transitions. */}
          <Area type="monotone" dataKey="BAU (safely managed)" stackId="s" fill="#cbd5e1" stroke="#94a3b8" fillOpacity={0.6} strokeWidth={1.5} legendType="rect" isAnimationActive animationDuration={600} animationEasing="ease-out" />
          {bands.map(([k, label, color]) => (
            <Area key={k} type="monotone" dataKey={label} stackId="s" fill={color} stroke={color} fillOpacity={0.55} strokeWidth={1} legendType="rect" isAnimationActive animationDuration={600} animationEasing="ease-out" />
          ))}
          {/* Total households — the coverage ceiling, drawn on top (not stacked). */}
          <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="6 4" dot={false} legendType="plainline" isAnimationActive animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
