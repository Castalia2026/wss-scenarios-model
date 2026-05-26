import React, { useState, useEffect, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import InterventionPanel from './components/InterventionPanel';
import ResultsDashboard from './components/ResultsDashboard';
import { BAUForecastChart, InterventionImpactChart } from './components/StaticCharts';
import { fetchDefaults } from './api';

export default function App() {
  const [inputs, setInputs] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [profileList, setProfileList] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<{name: string, inputs: any}[]>([]);
  const [geoScope, setGeoScope] = useState<'urban' | 'rural' | 'national'>('urban');
  const [sectorTab, setSectorTab] = useState<'water' | 'sanitation'>('water');
  const [showGuide, setShowGuide] = useState(true);

  const refreshProfiles = () => {
    fetch('/api/profiles').then(r => r.json()).then(setProfileList).catch(() => {});
  };

  useEffect(() => {
    fetchDefaults().then(setInputs).catch(() => {});
    refreshProfiles();
    const saved = localStorage.getItem('wss_demo_scenarios');
    if (saved) setScenarios(JSON.parse(saved));
  }, []);

  const resizeMacroArrays = useCallback((inp: any) => {
    if (!inp?.period?.model_start_year || !inp?.period?.forecast_end_year || !inp?.macro) return inp;
    const needed = inp.period.forecast_end_year - inp.period.model_start_year + 1;
    const macroFields = ['gdp_growth', 'gdp_nominal_usd', 'inflation_nepal', 'inflation_us', 'exchange_rate'];
    let changed = false;
    const newMacro = { ...inp.macro };
    for (const field of macroFields) {
      const arr = newMacro[field];
      if (!arr || arr.length === needed) continue;
      changed = true;
      newMacro[field] = arr.length < needed
        ? [...arr, ...Array(needed - arr.length).fill(field === 'gdp_nominal_usd' ? 0 : (arr[arr.length - 1] || 0))]
        : arr.slice(0, needed);
    }
    return changed ? { ...inp, macro: newMacro } : inp;
  }, []);

  const handleSetInputs = useCallback((newInputs: any) => {
    setInputs(resizeMacroArrays(newInputs));
  }, [resizeMacroArrays]);

  const saveScenario = () => {
    const name = prompt('Name this scenario:');
    if (!name) return;
    const updated = [...scenarios, { name, inputs: JSON.parse(JSON.stringify(inputs)) }];
    setScenarios(updated);
    localStorage.setItem('wss_demo_scenarios', JSON.stringify(updated));
  };

  const deleteScenario = (idx: number) => {
    const updated = scenarios.filter((_, i) => i !== idx);
    setScenarios(updated);
    localStorage.setItem('wss_demo_scenarios', JSON.stringify(updated));
  };

  // Validation
  const warnings: string[] = [];
  if (inputs) {
    const p = inputs.period;
    if (p.baseline_year >= p.as_is_forecast_start) warnings.push('Baseline year must be before as-is forecast start');
    if (p.target2_year < p.target1_year) warnings.push('Target 2 year must be >= Target 1 year');
    const wt = inputs.water_targets;
    const wsSum = Math.round((wt.target1_serv1 + wt.target1_serv2 + wt.target1_serv3 + wt.target1_serv4 + wt.target1_serv5) * 100);
    if (wsSum !== 100) warnings.push(`Water Target 1 service levels sum to ${wsSum}%, must be 100%`);
    const wsSum2 = Math.round((wt.target2_serv1 + wt.target2_serv2 + wt.target2_serv3 + wt.target2_serv4 + wt.target2_serv5) * 100);
    if (wsSum2 !== 100) warnings.push(`Water Target 2 service levels sum to ${wsSum2}%, must be 100%`);
    if (wt.providers) {
      const provSum = Math.round(wt.providers.reduce((s: number, p: any) => s + p.share_pct, 0) * 100);
      if (provSum !== 100) warnings.push(`Water provider shares sum to ${provSum}%, must be 100%`);
    }
    const st = inputs.sanitation_targets;
    const ssSum = Math.round((st.target1_sserv1 + st.target1_sserv2 + st.target1_sserv3 + st.target1_sserv4 + st.target1_sserv5) * 100);
    if (ssSum !== 100) warnings.push(`Sanitation Target 1 service levels sum to ${ssSum}%, must be 100%`);
    if (st.providers) {
      const sanProvSum = Math.round((st.providers.reduce((s: number, p: any) => s + p.share_pct, 0) + (st.onsite_collection_treatment_pct || 0)) * 100);
      if (sanProvSum !== 100) warnings.push(`Sanitation provider shares + on-site sum to ${sanProvSum}%, must be 100%`);
    }
  }

  const tabs = ['Data Input', 'BAU & Costs', 'Intervention Selection', 'Results Dashboard'];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#002244', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>WSS Strategic Scenarios Simulation Tool</h1>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{inputs?.country_config?.country || ''} — {inputs?.country_config?.area || ''}</span>
          {/* Geographic scope selector */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {(['urban', 'rural', 'national'] as const).map(g => (
              <button key={g} onClick={() => setGeoScope(g)} style={{
                padding: '4px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
                background: geoScope === g ? '#2563eb' : 'transparent',
                color: '#fff', cursor: 'pointer', fontSize: 11, textTransform: 'capitalize',
                fontWeight: geoScope === g ? 700 : 400,
                transition: 'background 0.15s',
              }}>{g}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select onChange={async (e) => {
            const val = e.target.value;
            if (val === '__blank') { const res = await fetch('/api/defaults/blank'); setInputs(await res.json()); }
            else if (val === '__default') { const res = await fetch('/api/defaults'); setInputs(await res.json()); }
            else if (val) { const res = await fetch(`/api/profiles/${val}`); setInputs(await res.json()); }
            e.target.value = '';
          }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: '#1e3a5f', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
            <option value="" style={{ background: '#fff', color: '#333' }}>Load Profile...</option>
            <option value="__default" style={{ background: '#fff', color: '#333' }}>Nepal KV (Default)</option>
            <option value="__blank" style={{ background: '#fff', color: '#333' }}>── New Blank Country ──</option>
            {profileList.length > 0 && <option disabled style={{ background: '#f1f5f9', color: '#94a3b8' }}>── Saved Profiles ──</option>}
            {profileList.map(name => (
              <option key={name} value={name} style={{ background: '#fff', color: '#333' }}>{name.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={async () => {
            const name = prompt('Save profile as:');
            if (!name) return;
            await fetch(`/api/profiles/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
            refreshProfiles(); alert(`Profile "${name}" saved!`);
          }} style={headerBtnStyle}>💾 Save Profile</button>
          <button onClick={saveScenario} style={headerBtnStyle}>📋 Save Scenario</button>
          <button onClick={() => {
            // Download Excel template
            fetch('/api/export/xlsx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs || {}) })
              .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'wss_data_input_template.xlsx'; a.click(); });
          }} style={headerBtnStyle}>📥 Excel Template</button>
          <button onClick={() => setShowOnboarding(true)} style={headerBtnStyle}>? Help</button>
        </div>
      </header>

      {/* Saved scenarios bar */}
      {scenarios.length > 0 && (
        <div style={{ background: '#f0f9ff', borderBottom: '1px solid #bae6fd', padding: '4px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ color: '#0369a1', fontWeight: 600 }}>Saved scenarios:</span>
          {scenarios.map((s, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={() => handleSetInputs(JSON.parse(JSON.stringify(s.inputs)))}
                style={{ padding: '2px 8px', border: '1px solid #bae6fd', borderRadius: 3, background: '#e0f2fe', color: '#0369a1', cursor: 'pointer', fontSize: 10 }}>
                {s.name}
              </button>
              <button onClick={() => {
                // Export individual scenario slide
                fetch('/api/export/pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.inputs) })
                  .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${s.name}_slide.pptx`; a.click(); });
              }} style={{ padding: '1px 4px', border: '1px solid #bae6fd', borderRadius: 2, background: '#fff', cursor: 'pointer', fontSize: 9, color: '#0369a1' }}>📑</button>
              <button onClick={() => deleteScenario(i)}
                style={{ padding: '1px 4px', border: '1px solid #fecaca', borderRadius: 2, background: '#fee2e2', cursor: 'pointer', fontSize: 9, color: '#dc2626' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <nav style={{ background: '#eef2f7', borderBottom: '2px solid #cbd5e1', display: 'flex', padding: '6px 20px 0', gap: 4 }}>
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '10px 28px', border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeTab === i ? '#fff' : 'transparent',
            boxShadow: activeTab === i ? '0 -2px 6px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
            color: activeTab === i ? '#1e3a5f' : '#64748b',
            borderBottom: activeTab === i ? '2px solid #fff' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s',
            position: 'relative',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: activeTab === i ? '#2563eb' : '#94a3b8',
                color: '#fff', flexShrink: 0,
              }}>{i + 1}</span>
              {tab}
            </span>
          </button>
        ))}
      </nav>

      {warnings.length > 0 && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', padding: '6px 20px', fontSize: 11 }}>
          {warnings.map((w, i) => <div key={i} style={{ color: '#92400e' }}>⚠ {w}</div>)}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 0 && inputs && (<>
          <InputPanel inputs={inputs} onChange={handleSetInputs} geoScope={geoScope} showSection="inputs" />
          <DataInputOverview inputs={inputs} geoScope={geoScope} />
        </>)}
        {activeTab === 1 && inputs && (<>
          <InputPanel inputs={inputs} onChange={handleSetInputs} geoScope={geoScope} showSection="bau" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            <SectorToggle value={sectorTab} onChange={setSectorTab} />
            <BAUForecastChart />
          </div>
        </>)}
        {activeTab === 2 && inputs && (
          <InterventionPanel inputs={inputs} onChange={handleSetInputs} sectorTab={sectorTab} onSectorChange={setSectorTab} />
        )}
        {activeTab === 3 && (
          <ResultsDashboard geoScope={geoScope} scenarios={scenarios} inputs={inputs} />
        )}

        {/* Data Guide toggle + panel */}
        <button onClick={() => setShowGuide(!showGuide)} style={{
          position: 'absolute', right: showGuide ? 340 : 0, top: 12,
          padding: '8px 6px', border: '1px solid #cbd5e1', borderRight: showGuide ? 'none' : '1px solid #cbd5e1',
          borderRadius: showGuide ? '6px 0 0 6px' : '6px 0 0 6px',
          background: showGuide ? '#eef2ff' : '#f8fafc', cursor: 'pointer',
          fontSize: 11, color: '#4338ca', fontWeight: 600, zIndex: 10,
          writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 1,
          boxShadow: '-2px 0 6px rgba(0,0,0,0.06)', transition: 'right 0.2s',
        }}>
          {showGuide ? '✕ Close' : '📋 Guide'}
        </button>
        {showGuide && <DataGuide tab={activeTab} />}
      </div>

      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}

function OnboardingModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 640, width: '92%', maxHeight: '85vh', overflowY: 'auto', padding: '24px 32px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, color: '#002244', marginBottom: 4 }}>WSS Strategic Scenarios Simulation Tool</h2>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Interactive prototype — Water Supply and Sanitation strategic scenario analysis</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { step: '1', title: 'Data Input', desc: 'Enter country data organized in collapsible groups: country configuration, macroeconomic assumptions, population, service levels, and targets. Supports urban-only, rural-only, or national analysis with urban + rural rollup.', icon: '📝' },
            { step: '2', title: 'BAU & Costs', desc: 'Enter unit costs for water supply and sanitation infrastructure, BAU investment data (budget allocations, planned investments, budget execution rates), and technical parameters (asset life, treatment capacity, non-HH rates).', icon: '💰' },
            { step: '3', title: 'Intervention Selection', desc: 'Toggle pre-built interventions on/off and configure parameters (start year, target %, lag to benefits, etc.). Includes: collection efficiency, NRW reduction, capital efficiency, tariff reform, borrowing, microfinance, and budget execution improvement. Add custom interventions.', icon: '🔧' },
            { step: '4', title: 'Results Dashboard', desc: 'View example outputs showing what the final tool will produce: coverage progress charts for rural water, urban water, and national water. Hover over data points for precise values. Save scenarios and export individual slides or full presentations.', icon: '📊' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>{s.icon}</div>
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', margin: '0 0 2px' }}>Tab {s.step}: {s.title}</h3>
                <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 10, color: '#475569' }}>
          <strong>Key features:</strong>
          <ul style={{ margin: '4px 0 0 14px', padding: 0, lineHeight: 1.7 }}>
            <li><strong>Geographic scope:</strong> Switch between Urban, Rural, or National in the header</li>
            <li><strong>Tooltips:</strong> Hover over any ⓘ icon for field description</li>
            <li><strong>Validation:</strong> Yellow warnings for invalid combinations (e.g., targets not summing to 100%)</li>
            <li><strong>Scenarios:</strong> Save scenarios and export individual PowerPoint slides per scenario</li>
            <li><strong>Excel template:</strong> Download the data input sheet as Excel for offline data collection</li>
            <li><strong>Country profiles:</strong> Load pre-built profiles or start blank for a new country</li>
          </ul>
        </div>

        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, fontSize: 10, color: '#92400e' }}>
          <strong>Prototype note:</strong> This is an interactive mock-up. Data entered is for demonstration purposes — no back-end calculations are performed. The Results Dashboard shows static example charts.
        </div>

        <button onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '10px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Get Started
        </button>
      </div>
    </div>
  );
}

function SectorToggle({ value, onChange }: { value: 'water' | 'sanitation'; onChange: (v: 'water' | 'sanitation') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['water', 'sanitation'] as const).map(s => (
        <button key={s} onClick={() => onChange(s)} style={{
          padding: '7px 18px', border: 'none', borderRadius: 5, cursor: 'pointer',
          background: value === s ? '#2563eb' : '#e5e7eb',
          color: value === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 12,
        }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
      ))}
    </div>
  );
}

// ─── Data Input Overview (middle panel for tab 0) ───
function DataInputOverview({ inputs, geoScope }: { inputs: any; geoScope: string }) {
  if (!inputs) return null;
  const cc = inputs.country_config || {};
  const p = inputs.period || {};
  const pop = inputs.population || {};
  const wt = inputs.water_targets || {};
  const st = inputs.sanitation_targets || {};
  const ws = inputs.water_service || {};
  const san = inputs.sanitation_service || {};
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';

  const wProviders = wt.providers || [];
  const sProviders = st.providers || [];

  // Completeness check helpers
  const filled = (v: any) => v !== undefined && v !== null && v !== 0 && v !== '';
  const sections = [
    { name: 'Country & Region', done: filled(cc.country) && filled(cc.currency), total: 2 },
    { name: 'Period', done: [p.model_start_year, p.forecast_end_year, p.baseline_year, p.target1_year, p.target2_year].filter(filled).length, total: 5 },
    { name: 'Macroeconomics', done: filled(inputs.macro?.wash_budget_pct_gdp) ? 1 : 0, total: 1 },
    { name: 'Population', done: [pop.total_pop_start, pop.total_hh_start, pop.total_pop_baseline, pop.total_hh_baseline].filter(filled).length, total: 4 },
    { name: 'Water Service Levels', done: [ws.hh_treated_piped_start, ws.pct_serv1_start].filter(filled).length, total: 2 },
    { name: 'Sanitation Service Levels', done: [san.hh_sewered_start, san.pct_sserv1_start].filter(filled).length, total: 2 },
    { name: 'Water Targets', done: [wt.target1_serv1, wt.planned_treatment_capacity_mld].filter(filled).length, total: 2 },
    { name: 'Sanitation Targets', done: [st.target1_sserv1, st.onsite_collection_treatment_pct].filter(filled).length, total: 2 },
  ];
  const totalDone = sections.reduce((s, x) => s + x.done, 0);
  const totalAll = sections.reduce((s, x) => s + x.total, 0);
  const pctDone = Math.round((totalDone / totalAll) * 100);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#fff' }}>
      {/* Country header card */}
      <div style={{ background: '#f0f4ff', borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: '1px solid #c7d2fe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>{cc.country || 'No country selected'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{cc.area || 'No region'} — <strong>{scopeLabel}</strong> scope</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Currency</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{cc.currency || '—'}</div>
          </div>
        </div>
      </div>

      {/* Completeness bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
          <span>Data completeness</span>
          <span style={{ fontWeight: 700, color: pctDone === 100 ? '#16a34a' : '#f59e0b' }}>{pctDone}%</span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pctDone}%`, background: pctDone === 100 ? '#16a34a' : '#2563eb', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {sections.map((s, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 10,
              background: s.done === s.total ? '#dcfce7' : s.done > 0 ? '#fef3c7' : '#f1f5f9',
              color: s.done === s.total ? '#16a34a' : s.done > 0 ? '#92400e' : '#94a3b8',
              fontWeight: 500,
            }}>
              {s.done === s.total ? '✓' : s.done > 0 ? '◐' : '○'} {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Key numbers summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <SummaryCard label="Analysis period" value={p.model_start_year && p.forecast_end_year ? `${p.model_start_year} – ${p.forecast_end_year}` : '—'} sub={`Baseline: ${p.baseline_year || '—'}`} />
        <SummaryCard label={`${scopeLabel} population`} value={pop.total_pop_baseline ? pop.total_pop_baseline.toLocaleString() : '—'} sub={`${pop.total_hh_baseline ? pop.total_hh_baseline.toFixed(3) + 'M HHs' : '—'} (${p.baseline_year || '—'})`} />
        <SummaryCard label="Target milestones" value={p.target1_year && p.target2_year ? `${p.target1_year} / ${p.target2_year}` : '—'} sub="Target 1 / Target 2" />
        <SummaryCard label="Pop. growth CAGR" value={pop.pop_growth_projected ? (pop.pop_growth_projected * 100).toFixed(2) + '%' : '—'} sub="Annual projection rate" />
      </div>

      {/* Providers summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', background: '#f0f9ff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>Water Supply Providers ({wProviders.length})</div>
          {wProviders.length === 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>None added yet</div>}
          {wProviders.map((prov: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: i < wProviders.length - 1 ? '1px solid #dbeafe' : 'none' }}>
              <span style={{ color: '#334155', fontWeight: 500 }}>{prov.name}</span>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>{(prov.share_pct * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div style={{ border: '1px solid #c4b5fd', borderRadius: 8, padding: '12px 14px', background: '#faf5ff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>Sanitation Providers ({sProviders.length})</div>
          {sProviders.length === 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>None added yet</div>}
          {sProviders.map((prov: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: i < sProviders.length - 1 ? '1px solid #e9d5ff' : 'none' }}>
              <span style={{ color: '#334155', fontWeight: 500 }}>{prov.name}</span>
              <span style={{ color: '#7c3aed', fontWeight: 600 }}>{(prov.share_pct * 100).toFixed(0)}%</span>
            </div>
          ))}
          {st.onsite_collection_treatment_pct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', color: '#64748b', fontStyle: 'italic' }}>
              <span>On-site</span>
              <span>{(st.onsite_collection_treatment_pct * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Water service levels at baseline (mini bar) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>Water Service Levels ({p.baseline_year || '—'})</div>
        <ServiceBar
          levels={[
            { name: cc.ws_serv1_name || 'Safely Managed', pct: ws.pct_serv1_baseline || 0, color: '#2563eb' },
            { name: cc.ws_serv2_name || 'Basic', pct: ws.pct_serv2_baseline || 0, color: '#10b981' },
            { name: cc.ws_serv3_name || 'Limited', pct: ws.pct_serv3_baseline || 0, color: '#f59e0b' },
            { name: cc.ws_serv4_name || 'Unimproved', pct: ws.pct_serv4_baseline || 0, color: '#ef4444' },
            { name: cc.ws_serv5_name || 'No Service', pct: ws.pct_serv5_baseline || 0, color: '#64748b' },
          ]}
        />
      </div>

      {/* Sanitation service levels at baseline */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>Sanitation Service Levels ({p.baseline_year || '—'})</div>
        <ServiceBar
          levels={[
            { name: cc.san_serv1_name || 'Safely Managed', pct: san.pct_sserv1_baseline || 0, color: '#7c3aed' },
            { name: cc.san_serv2_name || 'Basic', pct: san.pct_sserv2_baseline || 0, color: '#10b981' },
            { name: cc.san_serv3_name || 'Limited', pct: san.pct_sserv3_baseline || 0, color: '#f59e0b' },
            { name: cc.san_serv4_name || 'Unimproved', pct: san.pct_sserv4_baseline || 0, color: '#ef4444' },
            { name: cc.san_serv5_name || 'No Service', pct: san.pct_sserv5_baseline || 0, color: '#64748b' },
          ]}
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function ServiceBar({ levels }: { levels: { name: string; pct: number; color: string }[] }) {
  const total = levels.reduce((s, l) => s + l.pct, 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: '#e5e7eb' }}>
        {levels.map((l, i) => l.pct > 0 ? (
          <div key={i} style={{ width: `${l.pct * 100}%`, background: l.color, transition: 'width 0.3s' }}
            title={`${l.name}: ${(l.pct * 100).toFixed(1)}%`} />
        ) : null)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {levels.map((l, i) => (
          <span key={i} style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            <span style={{ color: '#475569' }}>{l.name}</span>
            <span style={{ color: '#94a3b8' }}>{(l.pct * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
      {total > 0 && Math.abs(total - 1) > 0.005 && (
        <div style={{ fontSize: 9, color: '#ef4444', marginTop: 2 }}>⚠ Sum: {(total * 100).toFixed(1)}% (should be 100%)</div>
      )}
    </div>
  );
}

// ─── Data Guide per tab ───
const guideData: Record<number, { title: string; sections: { heading: string; items: { field: string; source: string; url: string }[] }[] }> = {
  0: {
    title: 'Data Input — Where to Find the Data',
    sections: [
      {
        heading: '0. Country & Region',
        items: [
          { field: 'Country name & currency', source: 'World Bank country classification', url: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/906519' },
          { field: 'Region / area name', source: 'Government administrative divisions or project TOR', url: '#' },
        ],
      },
      {
        heading: '1. Period',
        items: [
          { field: 'Model start / baseline / forecast years', source: 'Project TOR or latest available census/survey year', url: '#' },
          { field: 'Target years (SDG milestones)', source: 'National WASH strategy or SDG 6 targets', url: 'https://sdgs.un.org/goals/goal6' },
        ],
      },
      {
        heading: '2. Macroeconomics',
        items: [
          { field: 'GDP growth, nominal GDP', source: 'IMF World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
          { field: 'Inflation (domestic & US)', source: 'World Bank Indicators or central bank', url: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG' },
          { field: 'Exchange rate (USD/LCU)', source: 'World Bank or central bank', url: 'https://data.worldbank.org/indicator/PA.NUS.FCRF' },
          { field: 'WASH budget % of GDP', source: 'Government budget documents, UNICEF WASH budget briefs', url: 'https://www.unicef.org/documents/wash-budget-briefs' },
        ],
      },
      {
        heading: '3. Population',
        items: [
          { field: 'Total population & HHs (start/baseline)', source: 'National census or UN Population Division', url: 'https://population.un.org/wpp/' },
          { field: 'Population growth CAGR', source: 'UN Population Division or national statistics office', url: 'https://population.un.org/wpp/' },
          { field: 'Average HH size trend', source: 'DHS or national household survey', url: 'https://dhsprogram.com/' },
        ],
      },
      {
        heading: '4–5. Service Levels (Water & Sanitation)',
        items: [
          { field: 'HHs by service level (JMP ladder)', source: 'WHO/UNICEF JMP country files', url: 'https://washdata.org/data/household' },
          { field: 'HHs with piped/treated water', source: 'Utility annual reports or JMP', url: 'https://washdata.org/' },
          { field: 'HHs with sewered / on-site sanitation', source: 'Utility data, JMP, or national sanitation survey', url: 'https://washdata.org/data/household' },
          { field: 'Provider-specific HH counts', source: 'Individual utility annual reports or regulator', url: '#' },
        ],
      },
      {
        heading: '6–7. Targets (Water & Sanitation)',
        items: [
          { field: 'Target service level distribution', source: 'National WASH policy/strategy document', url: '#' },
          { field: 'Provider share allocations', source: 'Government master plan or utility business plans', url: '#' },
          { field: 'Treatment capacity plans', source: 'Utility capital investment plans', url: '#' },
        ],
      },
    ],
  },
  1: {
    title: 'BAU & Costs — Where to Find the Data',
    sections: [
      {
        heading: '8. Water Supply Unit Costs',
        items: [
          { field: 'Network cost per HH (by service level)', source: 'Utility capital budgets or World Bank project appraisals', url: '#' },
          { field: 'Provider-specific connection costs', source: 'Individual utility annual reports', url: '#' },
          { field: 'Treatment cost per MLD', source: 'Engineering feasibility studies or IBNET', url: 'https://www.ib-net.org/' },
          { field: 'Non-piped solution costs (wells, boreholes)', source: 'UNICEF cost benchmarks or national WASH surveys', url: '#' },
        ],
      },
      {
        heading: '9. Sanitation Unit Costs',
        items: [
          { field: 'Sewerage cost per HH', source: 'Utility capital budgets or World Bank project appraisals', url: '#' },
          { field: 'WWT cost per MLD', source: 'Engineering studies or IBNET', url: 'https://www.ib-net.org/' },
          { field: 'On-site facility costs (septic, latrine)', source: 'National sanitation cost study or UNICEF', url: '#' },
          { field: 'FS collection & treatment costs', source: 'FSM cost studies (e.g., World Bank FSM toolbox)', url: 'https://www.worldbank.org/en/topic/sanitation/brief/fecal-sludge-management-tools' },
        ],
      },
      {
        heading: '10. BAU Investment',
        items: [
          { field: 'Historical & planned investment amounts', source: 'Government budget books, MTEF, or donor databases', url: '#' },
          { field: 'Regional spending shares', source: 'Government budget allocation documents', url: '#' },
          { field: 'Sector splits (water vs sanitation)', source: 'WASH sector review or TrackFin', url: 'https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/monitoring-and-evidence/wash-systems-monitoring/un-water-glaas/trackfin' },
          { field: 'Budget execution rates', source: 'Public expenditure reviews (PER) or PEFA assessments', url: 'https://www.pefa.org/' },
          { field: 'WASH budget as % of GDP', source: 'UN-Water GLAAS report or government budget docs', url: 'https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/monitoring-and-evidence/wash-systems-monitoring/un-water-glaas' },
        ],
      },
      {
        heading: '11. Technical Inputs',
        items: [
          { field: 'Asset useful life', source: 'Engineering standards or utility asset management plans', url: '#' },
          { field: 'Treatment capacity (existing & proposed)', source: 'Utility asset registers or feasibility studies', url: '#' },
          { field: 'Water requirement per WHO (lpcd)', source: 'WHO guidelines (50–100 lpcd)', url: 'https://www.who.int/publications/i/item/9789241548151' },
          { field: 'Wastewater factor (% of water supply)', source: 'Engineering norms (typically 70–80%)', url: '#' },
        ],
      },
    ],
  },
  2: {
    title: 'Interventions — Where to Find the Data',
    sections: [
      {
        heading: '12. Water Interventions',
        items: [
          { field: 'Collection efficiency (current & target ratio)', source: 'Utility billing & collection reports', url: '#' },
          { field: 'NRW % (current & target)', source: 'Utility NRW assessment or IBNET benchmarks', url: 'https://www.ib-net.org/' },
          { field: 'NRW capex unit cost (USD per m3/day)', source: 'World Bank NRW reduction cost studies', url: '#' },
          { field: 'Capital efficiency gains %', source: 'Procurement reform benchmarks (typically 10–30%)', url: '#' },
          { field: 'Tariff data (income, revenue, expenditure)', source: 'Utility financial statements + household surveys', url: '#' },
          { field: 'Borrowing parameters (DSCR, tenor, rate)', source: 'Local financial market or development bank terms', url: '#' },
        ],
      },
      {
        heading: '13. Sanitation Interventions',
        items: [
          { field: 'Collection efficiency & sewer tariff', source: 'Sanitation utility billing data', url: '#' },
          { field: 'Capital efficiency gains', source: 'Same procurement reform benchmarks as water', url: '#' },
          { field: 'Tariff & O&M recovery', source: 'Utility financial statements', url: '#' },
          { field: 'Borrowing parameters', source: 'Local financial market or development bank terms', url: '#' },
          { field: 'Microfinance (cost, tenor, adoption rate)', source: 'Microfinance institution data or pilot studies', url: '#' },
        ],
      },
      {
        heading: '14. Custom Interventions',
        items: [
          { field: 'Donor grants / government transfers', source: 'Donor commitment letters or project appraisals', url: '#' },
          { field: 'Climate finance or carbon credits', source: 'GCF, GEF, or carbon market platforms', url: 'https://www.greenclimate.fund/' },
          { field: 'PPP / private sector contributions', source: 'PPP contract or transaction advisor reports', url: '#' },
        ],
      },
    ],
  },
  3: {
    title: 'Results Dashboard — Guide',
    sections: [
      {
        heading: 'Reading the Charts',
        items: [
          { field: 'Coverage progress (stacked area)', source: 'Shows projected HHs by service level over time', url: '#' },
          { field: 'Financing gap chart', source: 'BAU investment vs. target investment needed', url: '#' },
          { field: 'National = Urban + Rural rollup', source: 'Switch to National scope in header to see all three charts', url: '#' },
        ],
      },
      {
        heading: 'Exporting Results',
        items: [
          { field: 'PowerPoint export', source: 'Generates presentation slides with charts & tables', url: '#' },
          { field: 'Excel export', source: 'Full data tables for offline analysis', url: '#' },
          { field: 'CSV export', source: 'Raw data for import into other tools', url: '#' },
        ],
      },
      {
        heading: 'Scenario Comparison',
        items: [
          { field: 'Save scenarios from header bar', source: 'Click "Save Scenario" to snapshot current inputs', url: '#' },
          { field: 'Load & compare saved scenarios', source: 'Click scenario name in the scenarios bar to restore', url: '#' },
          { field: 'Export individual scenario slides', source: 'Click the 📑 icon next to a saved scenario', url: '#' },
        ],
      },
    ],
  },
};

function DataGuide({ tab }: { tab: number }) {
  const guide = guideData[tab];
  if (!guide) return null;
  return (
    <div style={{
      width: 340, borderLeft: '1px solid #e2e8f0', background: '#fafaff', overflowY: 'auto',
      padding: '16px 18px', fontSize: 11, flexShrink: 0,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#312e81', margin: '0 0 12px', borderBottom: '2px solid #c7d2fe', paddingBottom: 6 }}>
        {guide.title}
      </h3>
      {guide.sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6, background: '#e0e7ff', padding: '4px 8px', borderRadius: 4 }}>
            {sec.heading}
          </div>
          {sec.items.map((item, ii) => (
            <div key={ii} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid #e0e7ff' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>{item.field}</div>
              <div style={{ color: '#64748b', lineHeight: 1.4 }}>
                {item.source}
                {item.url !== '#' && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', color: '#4338ca', fontSize: 10, marginTop: 2, wordBreak: 'break-all' }}>
                    {item.url}
                  </a>
                )}
                {item.url === '#' && (
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                    URL placeholder — to be updated
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 10, color: '#92400e' }}>
        <strong>Tip:</strong> If a specific data source is unavailable for your country, check the World Bank Open Data portal or contact the local WASH sector coordinator.
        <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', color: '#92400e', marginTop: 4 }}>
          https://data.worldbank.org/
        </a>
      </div>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
  background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 11,
};
