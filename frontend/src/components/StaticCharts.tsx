import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Cell
} from 'recharts';

// --- BAU Forecast static data ---
const bauYears = [2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040];
const bauForecastData = bauYears.map((y, i) => {
  const t = i / 15;
  return {
    year: y,
    'Safely Managed': +(0.49 + (0.81 - 0.49) * t).toFixed(3),
    'Basic': +(0.35 + (0.42 - 0.35) * Math.sin(t * Math.PI * 0.6)).toFixed(3),
    'Limited': +(0.03 - 0.02 * t).toFixed(3),
    'Unimproved': 0.005,
    'No Service': 0.002,
  };
});

const BAU_LINE_COLORS: Record<string, string> = {
  'Safely Managed': '#2563eb',
  'Basic': '#10b981',
  'Limited': '#f59e0b',
  'Unimproved': '#ef4444',
  'No Service': '#64748b',
};

// --- Intervention Impact waterfall data ---
const interventionImpactData = [
  { name: 'Service Gap',          value: 0.69,  fill: '#ef4444' },
  { name: 'Collection Efficiency', value: 0.05,  fill: '#10b981' },
  { name: 'NRW Reduction',        value: 0.29,  fill: '#10b981' },
  { name: 'Capital Efficiency',   value: 0.19,  fill: '#10b981' },
  { name: 'Tariff Reform',        value: 0.09,  fill: '#10b981' },
  { name: 'Borrowing',            value: 0.06,  fill: '#10b981' },
  { name: 'Budget Execution',     value: 0.03,  fill: '#10b981' },
  { name: 'Remaining Gap',        value: -0.02, fill: '#f59e0b' },
];

export function BAUForecastChart() {
  return (
    <div>
      <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>BAU Forecast — Service Levels Over Time (Example)</h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static mock-up — no live calculations
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={bauForecastData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: 'HH (millions)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={(value: number) => value.toFixed(3)} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {Object.keys(BAU_LINE_COLORS).map(key => (
            <Line key={key} type="monotone" dataKey={key} stroke={BAU_LINE_COLORS[key]} strokeWidth={2} dot={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InterventionImpactChart() {
  return (
    <div>
      <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>Intervention Impact — Closing the Gap at 2040 (Example)</h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static mock-up — no live calculations
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={interventionImpactData} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 10 }} label={{ value: 'HH (millions)', position: 'insideBottom', style: { fontSize: 10 } }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
          <Tooltip formatter={(value: number) => value.toFixed(3)} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {interventionImpactData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
