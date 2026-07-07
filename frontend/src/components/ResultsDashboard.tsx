import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Cell
} from 'recharts';

// Static example data for Nepal-like scenario
const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040];

const ruralWater = years.map(y => ({
  year: y,
  BAU: 0.15 + (y - 2025) * 0.008,
  'Collection & NRW': Math.max(0, (y - 2028) * 0.005),
  'Capital Efficiency': Math.max(0, (y - 2033) * 0.004),
  'Tariff Reform': Math.max(0, (y - 2028) * 0.002),
  Borrowing: Math.max(0, (y - 2036) * 0.003),
  Target: 0.15 + (y - 2025) * 0.025,
}));

const urbanWater = years.map(y => ({
  year: y,
  BAU: 0.49 + (y - 2025) * 0.021,
  'Collection & NRW': Math.max(0, (y - 2028) * 0.008),
  'Capital Efficiency': Math.max(0, (y - 2033) * 0.006),
  'Tariff Reform': Math.max(0, (y - 2028) * 0.003),
  Borrowing: Math.max(0, (y - 2036) * 0.005),
  Target: 0.49 + (y - 2025) * 0.067,
}));

const nationalWater = years.map((y, i) => ({
  year: y,
  BAU: ruralWater[i].BAU * 0.6 + urbanWater[i].BAU * 0.4,
  'Collection & NRW': ruralWater[i]['Collection & NRW'] * 0.6 + urbanWater[i]['Collection & NRW'] * 0.4,
  'Capital Efficiency': ruralWater[i]['Capital Efficiency'] * 0.6 + urbanWater[i]['Capital Efficiency'] * 0.4,
  'Tariff Reform': ruralWater[i]['Tariff Reform'] * 0.6 + urbanWater[i]['Tariff Reform'] * 0.4,
  Borrowing: ruralWater[i].Borrowing * 0.6 + urbanWater[i].Borrowing * 0.4,
  Target: ruralWater[i].Target * 0.6 + urbanWater[i].Target * 0.4,
}));

const financingData = years.map(y => ({
  year: y,
  'Investment Need': (2 + (y - 2025) * 0.8) * (y > 2025 ? 1 : 0),
  'BAU Investment': (1.5 + (y - 2025) * 0.15) * (y > 2025 ? 1 : 0),
  'Intervention Cash': Math.max(0, (y - 2028) * 0.3) * (y > 2025 ? 1 : 0),
}));

const COLORS = {
  bau: '#64748b', target: '#2563eb', ce_nrw: '#10b981', capeff: '#f59e0b',
  tariff: '#8b5cf6', loan: '#ec4899', inv_need: '#ef4444', bau_inv: '#64748b',
};

interface LayerActive { ceNrw: boolean; capeff: boolean; tariff: boolean; borrowing: boolean }
function MockChart({ data, title, active }: { data: any[]; title: string; active: LayerActive }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: 'HH (millions)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={(value: any) => (+(value ?? 0)).toFixed(3)} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="BAU" stackId="1" fill={COLORS.bau} stroke={COLORS.bau} fillOpacity={0.5} legendType="rect" />
          {active.ceNrw && <Area type="monotone" dataKey="Collection & NRW" stackId="1" fill={COLORS.ce_nrw} stroke={COLORS.ce_nrw} fillOpacity={0.6} legendType="rect" />}
          {active.capeff && <Area type="monotone" dataKey="Capital Efficiency" stackId="1" fill={COLORS.capeff} stroke={COLORS.capeff} fillOpacity={0.6} legendType="rect" />}
          {active.tariff && <Area type="monotone" dataKey="Tariff Reform" stackId="1" fill={COLORS.tariff} stroke={COLORS.tariff} fillOpacity={0.6} legendType="rect" />}
          {active.borrowing && <Area type="monotone" dataKey="Borrowing" stackId="1" fill={COLORS.loan} stroke={COLORS.loan} fillOpacity={0.6} legendType="rect" />}
          <Line type="monotone" dataKey="Target" stroke={COLORS.target} strokeWidth={2.5} dot={false} strokeDasharray="6 3" legendType="plainline" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

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

const BAU_LINE_COLORS: Record<string, string> = {
  'Safely Managed': '#2563eb',
  'Basic': '#10b981',
  'Limited': '#f59e0b',
  'Unimproved': '#ef4444',
  'No Service': '#64748b',
};

interface Props {
  geoScope: 'urban' | 'rural' | 'urban_rural' | 'national';
  scenarios: { name: string; inputs: any }[];
  inputs: any;
}

export default function ResultsDashboard({ geoScope, scenarios, inputs }: Props) {
  const [activeSector, setActiveSector] = useState<'water' | 'sanitation'>('water');
  // Local view scope for the dashboard charts (chosen from the dropdown in the side panel)
  const [viewScope, setViewScope] = useState<'urban' | 'rural' | 'national'>(
    geoScope === 'urban' ? 'urban' : geoScope === 'rural' ? 'rural' : 'national'
  );
  const [activeIntv, setActiveIntv] = useState<Record<string, boolean>>({
    'Collection Efficiency': true, 'NRW Reduction': true, 'Capital Efficiency': true,
    'Tariff Reform': true, 'Borrowing': true, 'Budget Execution': true,
  });
  const layerActive = {
    ceNrw: !!(activeIntv['Collection Efficiency'] || activeIntv['NRW Reduction']),
    capeff: !!activeIntv['Capital Efficiency'],
    tariff: !!activeIntv['Tariff Reform'],
    borrowing: !!activeIntv['Borrowing'],
  };
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Main scrollable charts area */}
      <div style={{ flex: 3, minWidth: 0, overflowY: 'auto', padding: '20px 28px' }}>
      {/* Prototype banner */}
      <div style={{ background: '#fef3c7', padding: '8px 14px', borderRadius: 6, fontSize: 11, color: '#92400e', marginBottom: 16 }}>
        <strong>Static mock-up:</strong> These charts show example outputs to demonstrate what the final tool will produce. No live calculations are performed.
      </div>

      {/* Coverage chart for the scope chosen in the side panel */}
      {(() => {
        const sectorName = activeSector === 'water' ? 'Water Supply' : 'Sanitation';
        const data = viewScope === 'rural' ? ruralWater : viewScope === 'urban' ? urbanWater : nationalWater;
        const scopeName = viewScope === 'rural' ? 'Rural' : viewScope === 'urban' ? 'Urban' : 'National';
        return <MockChart data={data} title={`${scopeName} ${sectorName} — Coverage Progress`} active={layerActive} />;
      })()}

      {/* Financing gap chart */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
          {activeSector === 'water' ? 'Water Supply' : 'Sanitation'} — Annual Financing Gap
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={financingData.filter(d => d.year > 2025)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} label={{ value: 'Billions', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip formatter={(value: any) => (+(value ?? 0)).toFixed(2)} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Investment Need" fill={COLORS.inv_need} opacity={0.7} />
            <Bar dataKey="BAU Investment" stackId="funding" fill={COLORS.bau_inv} opacity={0.7} />
            <Bar dataKey="Intervention Cash" stackId="funding" fill={COLORS.ce_nrw} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>Summary at Key Years (Example)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>Metric</th>
              <th style={thStyle}>2025</th>
              <th style={thStyle}>2030</th>
              <th style={thStyle}>2035</th>
              <th style={thStyle}>2040</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Total HH (millions)', '0.940', '1.098', '1.283', '1.499'],
              ['Target Safely Managed', '0.487', '0.725', '1.042', '1.499'],
              ['BAU Safely Managed', '0.487', '0.564', '0.671', '0.807'],
              ['Service Gap', '0.000', '0.161', '0.371', '0.691'],
              ['Financing Gap (bill)', '0.00', '6.98', '6.60', '10.23'],
              ['Adjusted Gap (bill)', '0.00', '5.88', '1.60', '4.53'],
            ].map(([label, ...vals]) => (
              <tr key={label}>
                <td style={tdStyle}>{label}</td>
                {vals.map((v, i) => <td key={i} style={{ ...tdStyle, textAlign: 'left', fontFamily: 'monospace' }}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Saved scenarios */}
      {scenarios.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>Saved Scenarios</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {scenarios.map((s, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', background: '#f8fafc' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', marginBottom: 4 }}>{s.name}</div>
                <button onClick={() => {
                  fetch('/api/export/pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.inputs) })
                    .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${s.name}.pptx`; a.click(); });
                }} style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  📑 Export Slide
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Left-hand control panel — stays visible while you scroll the charts */}
      <div style={{ order: -1, flex: 2, minWidth: 220, borderRight: '1px solid #e2e8f0', background: '#fafaff', overflowY: 'auto', padding: '16px 16px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#312e81', marginBottom: 4 }}>Controls</div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 14, fontStyle: 'italic' }}>Adjust these while viewing any graph.</div>

        {/* Geographic scope */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>Geographic scope</div>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <select value={viewScope} onChange={e => setViewScope(e.target.value as 'urban' | 'rural' | 'national')}
            style={{ width: '100%', padding: '7px 28px 7px 8px', borderRadius: 5, border: '1px solid #94a3b8', fontSize: 12, background: '#fff', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
            <option value="national">National</option>
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: '#475569' }}>▼</span>
        </div>

        {/* Sector */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>Sector</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['water', 'sanitation'] as const).map(s => (
            <button key={s} onClick={() => setActiveSector(s)} style={{
              flex: 1, padding: '7px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
              background: activeSector === s ? '#2563eb' : '#e5e7eb',
              color: activeSector === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 12,
            }}>{s === 'water' ? 'Water' : 'Sanitation'}</button>
          ))}
        </div>

        {/* Intervention toggles */}
        <div style={{ background: '#f0f4ff', padding: '10px 12px', borderRadius: 8, marginBottom: 14, border: '1px solid #c7d2fe' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#312e81', marginBottom: 8 }}>Toggle interventions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['Collection Efficiency', 'NRW Reduction', 'Capital Efficiency', 'Tariff Reform', 'Borrowing', 'Budget Execution'].map(name => (
              <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', padding: '5px 8px', background: '#fff', borderRadius: 5, border: '1px solid #e0e7ff' }}>
                <input type="checkbox" checked={!!activeIntv[name]} onChange={e => setActiveIntv(p => ({ ...p, [name]: e.target.checked }))} style={{ accentColor: '#2563eb', width: 15, height: 15 }} />
                <span>{name}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>
            Toggle these to add or remove each layer from the coverage charts.
          </div>
        </div>

        {/* Target adjustment */}
        <div style={{ background: '#fefce8', padding: '10px 12px', borderRadius: 8, border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Adjust targets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, color: '#78350f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Target 1 year</span>
              <input type="number" defaultValue={inputs?.period?.target1_year || 2030}
                style={{ width: 64, padding: '2px 4px', border: '1px solid #fbbf24', borderRadius: 3, fontSize: 11, textAlign: 'center' }} />
            </label>
            <label style={{ fontSize: 11, color: '#78350f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Target 2 year</span>
              <input type="number" defaultValue={inputs?.period?.target2_year || 2040}
                style={{ width: 64, padding: '2px 4px', border: '1px solid #fbbf24', borderRadius: 3, fontSize: 11, textAlign: 'center' }} />
            </label>
          </div>
          <div style={{ fontSize: 10, color: '#92400e', marginTop: 8, fontStyle: 'italic' }}>
            In the full tool, changing targets updates projections in real time.
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: 11 };
const tdStyle: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 11 };
