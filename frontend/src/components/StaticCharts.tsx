import React from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line
} from 'recharts';

// --- Historical + Forecast years ---
const allYears = [2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040];
const baselineIdx = 14; // 2025

// --- Water Supply BAU data (stacked area) ---
const waterBAUData = allYears.map((y, i) => {
  const t = i / (allYears.length - 1);
  const hist = i <= baselineIdx;
  return {
    year: y,
    'Safely Managed': +(hist ? 0 + t * 0.02 : 0.02 + (i - baselineIdx) * 0.018).toFixed(3),
    'Basic': +(hist ? 0.35 + t * 0.15 : 0.50 + (i - baselineIdx) * 0.012).toFixed(3),
    'Limited': +(hist ? 0.45 - t * 0.05 : 0.40 - (i - baselineIdx) * 0.008).toFixed(3),
    'Unimproved': +(hist ? 0.15 - t * 0.05 : 0.10 - (i - baselineIdx) * 0.005).toFixed(3),
    'No Service': +(hist ? 0.05 - t * 0.02 : 0.03 - (i - baselineIdx) * 0.002).toFixed(3),
  };
});

// --- Sanitation BAU data (different numbers) ---
const sanitationBAUData = allYears.map((y, i) => {
  const t = i / (allYears.length - 1);
  const hist = i <= baselineIdx;
  return {
    year: y,
    'Safely Managed': +(hist ? 0 + t * 0.01 : 0.01 + (i - baselineIdx) * 0.008).toFixed(3),
    'Basic': +(hist ? 0.20 + t * 0.18 : 0.38 + (i - baselineIdx) * 0.015).toFixed(3),
    'Limited': +(hist ? 0.55 - t * 0.08 : 0.47 - (i - baselineIdx) * 0.010).toFixed(3),
    'Unimproved': +(hist ? 0.18 - t * 0.06 : 0.12 - (i - baselineIdx) * 0.006).toFixed(3),
    'No Service': +(hist ? 0.07 - t * 0.03 : 0.04 - (i - baselineIdx) * 0.003).toFixed(3),
  };
});

const STACK_COLORS: Record<string, string> = {
  'Safely Managed': '#2563eb',
  'Basic': '#10b981',
  'Limited': '#f59e0b',
  'Unimproved': '#ef4444',
  'No Service': '#64748b',
};

export function BAUForecastChart({ sector = 'water' }: { sector?: 'water' | 'sanitation' }) {
  const data = sector === 'water' ? waterBAUData : sanitationBAUData;
  const label = sector === 'water' ? 'Water Supply' : 'Sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>{label} — BAU Service Levels (Stacked)</h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static example — historical (white) + forecast (yellow tint)
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v*100)}%`} label={{ value: '% of households', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={(value: number) => `${(value*100).toFixed(1)}%`} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {Object.keys(STACK_COLORS).reverse().map(key => (
            <Area key={key} type="monotone" dataKey={key} stackId="1" fill={STACK_COLORS[key]} stroke={STACK_COLORS[key]} fillOpacity={0.7} />
          ))}
          {/* Baseline year marker */}
          <Line type="monotone" dataKey={() => null} stroke="transparent" />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: '#64748b', marginTop: 4 }}>
        <span>◀ Historical data</span>
        <span style={{ color: '#1e3a5f', fontWeight: 700 }}>|2025|</span>
        <span>Forecast ▶</span>
      </div>
    </div>
  );
}

// Static stacked area chart for intervention impact view
const interventionYears = allYears.filter(y => y >= 2025);
const waterInterventionData = interventionYears.map(y => ({
  year: y,
  BAU: 0.49 + (y - 2025) * 0.021,
  'Collection & NRW': Math.max(0, (y - 2028) * 0.008),
  'Capital Efficiency': Math.max(0, (y - 2033) * 0.006),
  'Tariff Increase': Math.max(0, (y - 2028) * 0.003),
  Borrowing: Math.max(0, (y - 2036) * 0.005),
  Target: 0.49 + (y - 2025) * 0.067,
}));

const sanitationInterventionData = interventionYears.map(y => ({
  year: y,
  BAU: 0.32 + (y - 2025) * 0.015,
  'Collection & NRW': Math.max(0, (y - 2028) * 0.005),
  'Capital Efficiency': Math.max(0, (y - 2033) * 0.004),
  'Tariff Increase': Math.max(0, (y - 2028) * 0.002),
  Borrowing: Math.max(0, (y - 2036) * 0.003),
  Target: 0.32 + (y - 2025) * 0.045,
}));

export function InterventionImpactChart({ sector = 'water' }: { sector?: 'water' | 'sanitation' }) {
  const data = sector === 'water' ? waterInterventionData : sanitationInterventionData;
  const label = sector === 'water' ? 'Water Supply' : 'Sanitation';
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>{label} — Service Gap After Interventions</h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static example — intervention impact on coverage
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: 'Households (millions)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={(value: number) => value.toFixed(3)} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="BAU" stackId="1" fill="#64748b" stroke="#64748b" fillOpacity={0.5} />
          <Area type="monotone" dataKey="Collection & NRW" stackId="1" fill="#10b981" stroke="#10b981" fillOpacity={0.6} />
          <Area type="monotone" dataKey="Capital Efficiency" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} />
          <Area type="monotone" dataKey="Tariff Increase" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" fillOpacity={0.6} />
          <Area type="monotone" dataKey="Borrowing" stackId="1" fill="#ec4899" stroke="#ec4899" fillOpacity={0.6} />
          <Line type="monotone" dataKey="Target" stroke="#2563eb" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
