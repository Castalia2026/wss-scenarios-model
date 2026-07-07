import React, { useState, useEffect } from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Label, ReferenceLine,
} from 'recharts';

/**
 * BAU vs Target chart driven by the LIVE calculation engine (validated cell-by-cell against the
 * reference Excel). Re-computes whenever the shared inputs change (debounced).
 *
 * Accepts EITHER a single `inputs` (one area) or an `inputsList` of several area datasets that are
 * summed element-wise (Urban + Rural = National) — households, safely-managed BAU/target counts and
 * the financing gap are all additive across areas. So the National panel is a genuine sum of the two
 * per-area engine runs, not a synthetic scaling.
 */
export default function LiveBAUChart({ inputs, inputsList, sector, scopeLabel }:
  { inputs?: any; inputsList?: any[]; sector: 'water' | 'sanitation'; scopeLabel?: string }) {
  const datasets = ((inputsList && inputsList.length) ? inputsList : (inputs ? [inputs] : [])).filter(Boolean);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLines, setTargetLines] = useState<{ y: number; label: string }[]>([]);

  const depKey = JSON.stringify(datasets) + '|' + sector;
  useEffect(() => {
    if (!datasets.length) return;
    const h = setTimeout(() => {
      Promise.all(datasets.map(inp =>
        fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inp) })
          .then(r => { if (!r.ok) throw new Error('calc failed (' + r.status + ')'); return r.json(); })
      )).then(resList => {
        const base = resList[0];
        const years: number[] = base.years;
        const secOf = (res: any) => sector === 'water' ? res.water_supply : res.sanitation;
        // Element-wise sum across areas (Urban + Rural = National). All three series are additive.
        const sum = (pick: (res: any, i: number) => number) =>
          years.map((_: number, i: number) => resList.reduce((a, res) => a + (pick(res, i) || 0), 0));
        const total = sum((res, i) => res.total_hh[i]);
        const bau = sum((res, i) => secOf(res).bau_hh[0][i]);
        const tgt = sum((res, i) => secOf(res).target_hh[0][i]);

        const rows = years.map((y: number, i: number) => {
          const tot = +total[i].toFixed(4);
          // Safely-managed can never exceed total households — clamp both BAU and target for display.
          const bauC = +Math.min(total[i], bau[i]).toFixed(4);
          const tgtC = +Math.min(total[i], tgt[i]).toFixed(4);
          const gap = +Math.max(0, tgtC - bauC).toFixed(4);   // HH gap = target − BAU (safely managed)
          return {
            year: y,
            'Total households': tot,
            'Households with safely managed (BAU)': bauC,
            'Target (safely managed)': tgtC,
            'HH gap (target − BAU)': gap,
          };
        });
        setData(rows);

        // Horizontal reference line at each target's safely-managed level (Target 1 & Target 2 years)
        const per = datasets[0]?.period || {};
        const t1y = per.target1_year || 2030, t2y = per.target2_year || 2040;
        const refs: { y: number; label: string }[] = [];
        ([[t1y, 'Target 1'], [t2y, 'Target 2']] as [number, string][]).forEach(([yr, lbl]) => {
          const ix = years.indexOf(yr);
          if (ix >= 0) refs.push({ y: +Math.min(total[ix], tgt[ix]).toFixed(4), label: `${lbl} (${yr})` });
        });
        setTargetLines(refs);

        const i1 = years.indexOf(t1y);
        const finGap = i1 >= 0 ? resList.reduce((a, res) => a + (secOf(res).financing_gap[i1] || 0), 0) : null;
        setSummary({ gapT1: finGap, t1: t1y, costSM: datasets.length === 1 ? secOf(base).cost_per_hh : null });
        setError(null);
      }).catch(e => setError(String(e)));
    }, 350);
    return () => clearTimeout(h);
  }, [depKey]);

  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel ? scopeLabel + ' ' : ''}{sectorLabel} - BAU vs Target (live calculation engine)
      </h3>
      <div style={{ fontSize: 10, color: '#065f46', background: '#d1fae5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Live engine output, validated against the reference Excel workbook.{datasets.length > 1 ? ' National = Urban + Rural (summed).' : ' Edits on the Data Inputs / Test Harness tabs recompute this chart.'}
      </div>
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {summary && (
        <div style={{ fontSize: 11, color: '#334155', marginBottom: 8 }}>
          {summary.costSM != null && <>Weighted safely-managed cost/HH: <b>{Math.round(summary.costSM).toLocaleString()}</b> | </>}
          {summary.gapT1 != null && <>Financing gap at {summary.t1}: <b>{Math.round(summary.gapT1).toLocaleString()} M</b></>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 70, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(value: any) => (+(value ?? 0)).toFixed(3) + 'M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="Households with safely managed (BAU)" fill="#7dd3fc" stroke="#0ea5e9" fillOpacity={0.55} legendType="rect" />
          <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={2.5} dot={false} legendType="plainline" strokeDasharray="8 4" />
          <Line type="monotone" dataKey="Target (safely managed)" stroke="#16a34a" strokeWidth={3} dot={false} legendType="plainline" />
          {/* HH gap — orange line (target − BAU, safely managed) */}
          <Line type="monotone" dataKey="HH gap (target − BAU)" stroke="#f97316" strokeWidth={2} dot={false} legendType="plainline" strokeDasharray="5 3" />
          {/* Horizontal reference line at each target's safely-managed level */}
          {targetLines.map((t, i) => (
            <ReferenceLine key={i} y={t.y} stroke="#16a34a" strokeDasharray="2 4" ifOverflow="extendDomain"
              label={{ value: t.label, position: 'right', fontSize: 9, fill: '#15803d' }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
