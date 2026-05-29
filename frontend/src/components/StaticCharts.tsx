import React from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Label
} from 'recharts';

const allYears = [2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040];

// Geographic scope scaling factors (urban is largest, rural smaller, national = sum)
const SCOPE_FACTORS: Record<string, { total: number; bau: number; tgt: number }> = {
  urban:       { total: 1.0,  bau: 1.0,  tgt: 1.0 },
  rural:       { total: 0.65, bau: 0.45, tgt: 0.55 },
  // Urban + Rural is entered separately then aggregated, so it equals the national sum
  urban_rural: { total: 1.65, bau: 1.45, tgt: 1.55 },
  national:    { total: 1.65, bau: 1.45, tgt: 1.55 },
};

function scopeLabelFor(geoScope: string) {
  return geoScope === 'national' ? 'National'
    : geoScope === 'rural' ? 'Rural'
    : geoScope === 'urban_rural' ? 'Urban + Rural'
    : 'Urban';
}

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
  const scopeLabel = scopeLabelFor(geoScope);
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
          <YAxis tick={{ fontSize: 10 }} domain={[0, (geoScope === 'national' || geoScope === 'urban_rural') ? 3 : 1.6]}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(value: number) => value.toFixed(2) + 'M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* BAU shaded area — box legend */}
          <Area type="monotone" dataKey="Households under BAU" fill="#7dd3fc" stroke="#0ea5e9" fillOpacity={0.55} legendType="rect"
            name={`Households with ${serviceLabel} under BAU`} />
          {/* Total HHs dashed line — line legend */}
          <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={2.5} dot={false} legendType="plainline"
            strokeDasharray="8 4" name="Total households" />
          {/* Target line — line legend */}
          <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeWidth={3} dot={false} legendType="plainline"
            name="Target" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Intervention Impact Charts ───
function makeIntvData(sector: 'water' | 'sanitation', geoScope: string) {
  const f = SCOPE_FACTORS[geoScope] || SCOPE_FACTORS.urban;
  const baseBau = sector === 'water' ? 0.4 : 0.25;
  const bauSlope = sector === 'water' ? 0.5 : 0.4;
  const tgtSlope = sector === 'water' ? 0.065 : 0.045;
  const ceSlope = sector === 'water' ? 0.025 : 0.015;
  const capSlope = sector === 'water' ? 0.018 : 0.012;
  const tarSlope = sector === 'water' ? 0.012 : 0.008;
  const borSlope = sector === 'water' ? 0.008 : 0.005;
  return allYears.map((y) => {
    const t = (y - 2020) / 20;
    const intv = y <= 2027 ? 0 : (y - 2027);
    const totalHH = (0.8 + t * 0.7) * f.total;
    const bauHH = (baseBau + t * 0.4 * bauSlope) * f.bau;
    return {
      year: y,
      'Total households': +totalHH.toFixed(2),
      'BAU': +bauHH.toFixed(2),
      'Collection & NRW': +(intv * ceSlope * f.tgt).toFixed(3),
      'Capital efficiency': +(intv * capSlope * f.tgt).toFixed(3),
      'Tariff increase': +(intv * tarSlope * f.tgt).toFixed(3),
      'Borrowing': +(intv * borSlope * f.tgt).toFixed(3),
      'Target': +Math.min(y <= 2027 ? bauHH : bauHH + intv * tgtSlope * f.tgt, totalHH).toFixed(2),
    };
  });
}

const INTV_COLORS = {
  'BAU': '#cbd5e1',            // light gray
  'Collection & NRW': '#0ea5e9', // sky blue
  'Capital efficiency': '#6366f1', // indigo
  'Tariff increase': '#f59e0b',   // amber
  'Borrowing': '#ec4899',         // pink
};

export function InterventionImpactChart({ sector = 'water', geoScope = 'urban' }: { sector?: 'water' | 'sanitation'; geoScope?: string }) {
  const data = makeIntvData(sector, geoScope);
  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  const scopeLabel = scopeLabelFor(geoScope);
  const serviceLabel = sector === 'water' ? 'treated, piped water' : 'safely managed sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel} {sectorLabel} — Service Gap After Interventions
      </h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static example data — {scopeLabel} scope
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, (geoScope === 'national' || geoScope === 'urban_rural') ? 3 : 1.6]}>
            <Label value="# households (millions)" angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
          </YAxis>
          <Tooltip formatter={(value: number) => value.toFixed(3) + 'M'} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {/* Stacked intervention areas — box legend */}
          <Area type="monotone" dataKey="BAU" stackId="1" fill={INTV_COLORS['BAU']} stroke="#94a3b8" fillOpacity={0.75} legendType="rect"
            name={`Households with ${serviceLabel} under BAU`} />
          <Area type="monotone" dataKey="Collection & NRW" stackId="1" fill={INTV_COLORS['Collection & NRW']} stroke={INTV_COLORS['Collection & NRW']} fillOpacity={0.75} legendType="rect"
            name="Increased collection efficiency & NRW reduction" />
          <Area type="monotone" dataKey="Capital efficiency" stackId="1" fill={INTV_COLORS['Capital efficiency']} stroke={INTV_COLORS['Capital efficiency']} fillOpacity={0.75} legendType="rect"
            name="Increased efficiency in capital expenditure" />
          <Area type="monotone" dataKey="Tariff increase" stackId="1" fill={INTV_COLORS['Tariff increase']} stroke={INTV_COLORS['Tariff increase']} fillOpacity={0.75} legendType="rect"
            name="Tariff increase" />
          <Area type="monotone" dataKey="Borrowing" stackId="1" fill={INTV_COLORS['Borrowing']} stroke={INTV_COLORS['Borrowing']} fillOpacity={0.75} legendType="rect"
            name="Borrow against future cashflow" />
          {/* Total HHs dashed line — line legend */}
          <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={2.5} dot={false} legendType="plainline"
            strokeDasharray="8 4" name="Total households" />
          {/* Target line — line legend */}
          <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeWidth={3} dot={false} legendType="plainline"
            name="Target" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
