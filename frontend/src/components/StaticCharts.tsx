import React from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Label
} from 'recharts';

const allYears = [2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040];

// Geographic scope scaling factors (urban is largest, rural smaller, national = sum)
const SCOPE_FACTORS: Record<string, { total: number; bau: number; tgt: number }> = {
  urban:    { total: 1.0,  bau: 1.0,  tgt: 1.0 },
  rural:    { total: 0.65, bau: 0.45, tgt: 0.55 },
  national: { total: 1.65, bau: 1.45, tgt: 1.55 },
};

function makeBAUData(sector: 'water' | 'sanitation', geoScope: string) {
  const f = SCOPE_FACTORS[geoScope] || SCOPE_FACTORS.urban;
  const baseBau = sector === 'water' ? 0.4 : 0.25;
  const bauSlope = sector === 'water' ? 0.5 : 0.4;
  const tgtSlope = sector === 'water' ? 0.065 : 0.045;
  return allYears.map((y) => {
    const t = (y - 2020) / 20;
    const totalHH = (0.8 + t * 0.7) * f.total;
    const bauHH = (baseBau + t * 0.4 * bauSlope) * f.bau;
    const targetHH = (y <= 2027 ? bauHH : bauHH + (y - 2027) * tgtSlope * f.tgt);
    return {
      year: y,
      'Total households': +totalHH.toFixed(2),
      'Households under BAU': +bauHH.toFixed(2),
      'Target': +Math.min(targetHH, totalHH).toFixed(2),
    };
  });
}

export function BAUForecastChart({ sector = 'water', geoScope = 'urban' }: { sector?: 'water' | 'sanitation'; geoScope?: string }) {
  const data = makeBAUData(sector, geoScope);
  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';
  const serviceLabel = sector === 'water' ? 'treated, piped water' : 'safely managed sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel} {sectorLabel} — BAU Service Gap
      </h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static example data — {scopeLabel} scope
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, geoScope === 'national' ? 3 : 1.6]}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(value: number) => value.toFixed(2) + 'M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* BAU shaded area */}
          <Area type="monotone" dataKey="Households under BAU" fill="#d1d5db" stroke="#9ca3af" fillOpacity={0.6}
            name={`Households with ${serviceLabel} under BAU`} />
          {/* Total HHs dashed line */}
          <Line type="monotone" dataKey="Total households" stroke="#9ca3af" strokeWidth={2.5} dot={false}
            strokeDasharray="8 4" name="Total households" />
          {/* Target line */}
          <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeWidth={3} dot={false}
            name="Target" />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Right-side annotation labels for last data point */}
      {(() => {
        const last = data[data.length - 1];
        const items = [
          { color: '#9ca3af', label: 'Total households', value: last['Total households'] },
          { color: '#d1d5db', label: `HHs with ${serviceLabel} (BAU)`, value: last['Households under BAU'] },
          { color: '#16a34a', label: 'Target', value: last['Target'] },
        ];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4, fontSize: 10, color: '#475569' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: it.color, display: 'inline-block', flexShrink: 0 }} />
                <span>{it.label}: <b>{it.value.toFixed(2)}M</b> ({last.year})</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Intervention Impact Charts ───
const waterIntvData = allYears.map((y) => {
  const t = (y - 2020) / 20;
  const totalHH = 0.8 + t * 0.7;
  const bauHH = 0.4 + t * 0.4 * 0.5;
  const intv = y <= 2027 ? 0 : (y - 2027);
  return {
    year: y,
    'Total households': +totalHH.toFixed(2),
    'BAU': +bauHH.toFixed(2),
    'Collection & NRW': +(intv * 0.025).toFixed(3),
    'Capital efficiency': +(intv * 0.018).toFixed(3),
    'Tariff increase': +(intv * 0.012).toFixed(3),
    'Borrowing': +(intv * 0.008).toFixed(3),
    'Target': +Math.min(y <= 2027 ? bauHH : bauHH + intv * 0.065, totalHH).toFixed(2),
  };
});

const sanIntvData = allYears.map((y) => {
  const t = (y - 2020) / 20;
  const totalHH = 0.8 + t * 0.7;
  const bauHH = 0.25 + t * 0.4 * 0.4;
  const intv = y <= 2027 ? 0 : (y - 2027);
  return {
    year: y,
    'Total households': +totalHH.toFixed(2),
    'BAU': +bauHH.toFixed(2),
    'Collection & NRW': +(intv * 0.015).toFixed(3),
    'Capital efficiency': +(intv * 0.012).toFixed(3),
    'Tariff increase': +(intv * 0.008).toFixed(3),
    'Borrowing': +(intv * 0.005).toFixed(3),
    'Target': +Math.min(y <= 2027 ? bauHH : bauHH + intv * 0.045, totalHH).toFixed(2),
  };
});

const INTV_COLORS = {
  'BAU': '#d1d5db',
  'Collection & NRW': '#93c5fd',
  'Capital efficiency': '#3b82f6',
  'Tariff increase': '#1d4ed8',
  'Borrowing': '#1e3a5f',
};

export function InterventionImpactChart({ sector = 'water' }: { sector?: 'water' | 'sanitation' }) {
  const data = sector === 'water' ? waterIntvData : sanIntvData;
  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  const serviceLabel = sector === 'water' ? 'treated, piped water' : 'safely managed sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {sectorLabel} — Service Gap After Interventions
      </h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static example data
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 1.6]}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(value: number) => value.toFixed(3) + 'M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* Stacked intervention areas */}
          <Area type="monotone" dataKey="BAU" stackId="1" fill={INTV_COLORS['BAU']} stroke="#9ca3af" fillOpacity={0.7}
            name={`Households with ${serviceLabel} under BAU`} />
          <Area type="monotone" dataKey="Collection & NRW" stackId="1" fill={INTV_COLORS['Collection & NRW']} stroke={INTV_COLORS['Collection & NRW']} fillOpacity={0.7}
            name="Increased collection efficiency & NRW reduction" />
          <Area type="monotone" dataKey="Capital efficiency" stackId="1" fill={INTV_COLORS['Capital efficiency']} stroke={INTV_COLORS['Capital efficiency']} fillOpacity={0.7}
            name="Increased efficiency in capital expenditure" />
          <Area type="monotone" dataKey="Tariff increase" stackId="1" fill={INTV_COLORS['Tariff increase']} stroke={INTV_COLORS['Tariff increase']} fillOpacity={0.7}
            name="Tariff increase" />
          <Area type="monotone" dataKey="Borrowing" stackId="1" fill={INTV_COLORS['Borrowing']} stroke={INTV_COLORS['Borrowing']} fillOpacity={0.7}
            name="Borrow against future cashflow" />
          {/* Total HHs dashed line */}
          <Line type="monotone" dataKey="Total households" stroke="#9ca3af" strokeWidth={2.5} dot={false}
            strokeDasharray="8 4" />
          {/* Target line */}
          <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeWidth={3} dot={false}
            name="Target" />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Right-side annotation labels for last data point */}
      {(() => {
        const last = data[data.length - 1];
        const items = [
          { color: '#9ca3af', label: 'Total households', value: last['Total households'] },
          { color: INTV_COLORS['BAU'], label: `HHs (BAU)`, value: last['BAU'] },
          { color: INTV_COLORS['Collection & NRW'], label: 'Collection & NRW', value: last['Collection & NRW'] },
          { color: INTV_COLORS['Capital efficiency'], label: 'Capital efficiency', value: last['Capital efficiency'] },
          { color: INTV_COLORS['Tariff increase'], label: 'Tariff increase', value: last['Tariff increase'] },
          { color: INTV_COLORS['Borrowing'], label: 'Borrowing', value: last['Borrowing'] },
          { color: '#16a34a', label: 'Target', value: last['Target'] },
        ];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4, fontSize: 10, color: '#475569' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: it.color, display: 'inline-block', flexShrink: 0 }} />
                <span>{it.label}: <b>{it.value.toFixed(3)}M</b> ({last.year})</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
