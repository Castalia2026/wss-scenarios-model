import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line
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
  const serviceGap = 0.691;
  const interventions = [
    { name: 'Collection Efficiency', value: 0.050, color: '#10b981' },
    { name: 'NRW Reduction', value: 0.289, color: '#10b981' },
    { name: 'Capital Efficiency', value: 0.192, color: '#f59e0b' },
    { name: 'Tariff Reform', value: 0.091, color: '#8b5cf6' },
    { name: 'Borrowing', value: 0.061, color: '#ec4899' },
    { name: 'Budget Execution', value: 0.030, color: '#06b6d4' },
  ];
  const totalClosed = interventions.reduce((s, i) => s + i.value, 0);
  const remaining = Math.max(0, serviceGap - totalClosed);
  const pctClosed = serviceGap > 0 ? (totalClosed / serviceGap * 100) : 0;

  const items = [
    { name: 'Gap (2040)', value: serviceGap, color: '#ef4444', isGap: true },
    ...interventions.map(i => ({ ...i, isGap: false })),
    { name: 'Remaining Gap', value: remaining, color: '#fca5a5', isGap: true },
  ];

  return (
    <div>
      <h3 style={{ fontSize: 13, marginBottom: 4, fontWeight: 600, color: '#1e3a5f' }}>Intervention Impact — Closing the Gap at 2040 (Example)</h3>
      <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Static mock-up — no live calculations
      </div>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
        {pctClosed.toFixed(0)}% of the service gap closed by interventions
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => {
          const width = serviceGap > 0 ? Math.max(1, (Math.abs(item.value) / serviceGap) * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 150, fontSize: 11, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{item.name}</span>
              <div style={{ flex: 1, position: 'relative', height: 22 }}>
                <div style={{
                  width: `${width}%`, height: '100%', borderRadius: 3,
                  background: item.color, opacity: item.isGap ? 0.6 : 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                }}>
                  {width > 12 && <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
                    {(item.value * 1000000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} HH
                  </span>}
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#64748b', width: 60, textAlign: 'right' }}>
                {item.value.toFixed(3)} M
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
