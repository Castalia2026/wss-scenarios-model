import React, { useState, useEffect } from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Label,
} from 'recharts';

/**
 * BAU vs Target chart driven by the LIVE calculation engine (validated cell-by-cell against the
 * reference Excel). Re-computes whenever the shared inputs change (debounced), so edits made on
 * the Data Inputs tab or the Test Harness tab reflow this chart immediately.
 */
export default function LiveBAUChart({ inputs, sector, scopeLabel }: { inputs: any; sector: 'water' | 'sanitation'; scopeLabel?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inputs) return;
    const h = setTimeout(() => {
      fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) })
        .then(r => { if (!r.ok) throw new Error('calc failed (' + r.status + ')'); return r.json(); })
        .then(res => {
          const sec = sector === 'water' ? res.water_supply : res.sanitation;
          setData(res.years.map((y: number, i: number) => ({
            year: y,
            'Total households': +res.total_hh[i].toFixed(4),
            'Households with safely managed (BAU)': +sec.bau_hh[0][i].toFixed(4),
            'Target (safely managed)': +sec.target_hh[0][i].toFixed(4),
          })));
          const i30 = res.years.indexOf(inputs?.period?.target1_year || 2030);
          setSummary({
            gapT1: i30 >= 0 ? sec.financing_gap[i30] : null,
            costSM: sec.cost_per_hh,
            t1: inputs?.period?.target1_year || 2030,
          });
          setError(null);
        })
        .catch(e => setError(String(e)));
    }, 350);
    return () => clearTimeout(h);
  }, [inputs, sector]);

  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel ? scopeLabel + ' ' : ''}{sectorLabel} - BAU vs Target (live calculation engine)
      </h3>
      <div style={{ fontSize: 10, color: '#065f46', background: '#d1fae5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Live engine output, validated against the reference Excel workbook. Edits on the Data Inputs / Test Harness tabs recompute this chart.
      </div>
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {summary && (
        <div style={{ fontSize: 11, color: '#334155', marginBottom: 8 }}>
          Weighted safely-managed cost/HH: <b>{Math.round(summary.costSM).toLocaleString()}</b>
          {summary.gapT1 != null && <> | Financing gap at {summary.t1}: <b>{Math.round(summary.gapT1).toLocaleString()} M</b></>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
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
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
