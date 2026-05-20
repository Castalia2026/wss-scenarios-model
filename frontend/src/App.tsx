import React, { useState, useEffect, useRef, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import { fetchDefaults, runCalculation } from './api';

interface SavedScenario {
  name: string;
  inputs: any;
  timestamp: number;
}

export default function App() {
  const [inputs, setInputs] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [profileList, setProfileList] = useState<string[]>([]);

  const refreshProfiles = () => {
    fetch('/api/profiles').then(r => r.json()).then(setProfileList).catch(() => {});
  };

  useEffect(() => {
    fetchDefaults().then(setInputs).catch(() => setError('Failed to load defaults. Is the backend running?'));
    const saved = localStorage.getItem('wss_scenarios');
    if (saved) setSavedScenarios(JSON.parse(saved));
    refreshProfiles();
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
      if (arr.length < needed) {
        const lastVal = field === 'gdp_nominal_usd' ? 0 : (arr[arr.length - 1] || 0);
        newMacro[field] = [...arr, ...Array(needed - arr.length).fill(lastVal)];
      } else {
        newMacro[field] = arr.slice(0, needed);
      }
    }
    return changed ? { ...inp, macro: newMacro } : inp;
  }, []);

  const handleSetInputs = useCallback((newInputs: any) => {
    setInputs(resizeMacroArrays(newInputs));
  }, [resizeMacroArrays]);

  const saveScenario = () => {
    const name = prompt('Name this scenario:');
    if (!name) return;
    const scenario: SavedScenario = { name, inputs: JSON.parse(JSON.stringify(inputs)), timestamp: Date.now() };
    const updated = [...savedScenarios, scenario];
    setSavedScenarios(updated);
    localStorage.setItem('wss_scenarios', JSON.stringify(updated));
  };

  const loadScenario = (s: SavedScenario) => {
    handleSetInputs(JSON.parse(JSON.stringify(s.inputs)));
  };

  const deleteScenario = (idx: number) => {
    const updated = savedScenarios.filter((_, i) => i !== idx);
    setSavedScenarios(updated);
    localStorage.setItem('wss_scenarios', JSON.stringify(updated));
  };

  const resetToDefaults = async () => {
    const defaults = await fetchDefaults();
    setInputs(defaults);
  };

  // Input validation warnings
  const warnings: string[] = [];
  if (inputs) {
    const p = inputs.period;
    if (p.baseline_year >= p.as_is_forecast_start) warnings.push('Baseline year must be before as-is forecast start');
    if (p.target1_year <= p.as_is_forecast_start + p.as_is_forecast_length - 1) warnings.push('Target 1 year must be after as-is forecast ends');
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
    const ssSum2 = Math.round((st.target2_sserv1 + st.target2_sserv2 + st.target2_sserv3 + st.target2_sserv4 + st.target2_sserv5) * 100);
    if (ssSum2 !== 100) warnings.push(`Sanitation Target 2 service levels sum to ${ssSum2}%, must be 100%`);
    if (st.providers) {
      const sanProvSum = Math.round((st.providers.reduce((s: number, p: any) => s + p.share_pct, 0) + (st.onsite_collection_treatment_pct || 0)) * 100);
      if (sanProvSum !== 100) warnings.push(`Sanitation provider shares + on-site sum to ${sanProvSum}%, must be 100%`);
    }

    const wsStart = inputs.water_service;
    const wsStartSum = Math.round((wsStart.pct_serv1_start + wsStart.pct_serv2_start + wsStart.pct_serv3_start + wsStart.pct_serv4_start + wsStart.pct_serv5_start) * 100);
    if (wsStartSum !== 100) warnings.push(`Water service levels at start year sum to ${wsStartSum}%, must be 100%`);
    const wsBaseSum = Math.round((wsStart.pct_serv1_baseline + wsStart.pct_serv2_baseline + wsStart.pct_serv3_baseline + wsStart.pct_serv4_baseline + wsStart.pct_serv5_baseline) * 100);
    if (wsBaseSum !== 100) warnings.push(`Water service levels at baseline sum to ${wsBaseSum}%, must be 100%`);

    const ssStart = inputs.sanitation_service;
    const ssStartSum = Math.round((ssStart.pct_sserv1_start + ssStart.pct_sserv2_start + ssStart.pct_sserv3_start + ssStart.pct_sserv4_start + ssStart.pct_sserv5_start) * 100);
    if (ssStartSum !== 100) warnings.push(`Sanitation service levels at start year sum to ${ssStartSum}%, must be 100%`);
    const ssBaseSum = Math.round((ssStart.pct_sserv1_baseline + ssStart.pct_sserv2_baseline + ssStart.pct_sserv3_baseline + ssStart.pct_sserv4_baseline + ssStart.pct_sserv5_baseline) * 100);
    if (ssBaseSum !== 100) warnings.push(`Sanitation service levels at baseline sum to ${ssBaseSum}%, must be 100%`);
  }

  const steps = ['Data Inputs', 'BAU & Targets', 'Interventions', 'Outputs'];

  // Map steps to InputPanel sections
  const sectionMap: Record<number, string> = {
    0: 'inputs',        // sections 0-7
    1: 'bau',           // sections 8-11
    2: 'interventions',  // sections 12-14
    3: 'outputs',        // placeholder
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ background: '#002244', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Project WSS — Data Entry Tool</h1>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{inputs?.country_config?.country || ''} — {inputs?.country_config?.area || ''}</span>
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
            const name = prompt('Save profile as (e.g. "kenya_nairobi"):');
            if (!name) return;
            await fetch(`/api/profiles/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
            refreshProfiles();
            alert(`Profile "${name}" saved!`);
          }} style={headerBtnStyle}>💾 Save Profile</button>
          {profileList.length > 0 && <button onClick={async () => {
            const name = prompt(`Delete which profile?\n\nAvailable: ${profileList.join(', ')}`);
            if (!name) return;
            if (!profileList.includes(name)) { alert(`Profile "${name}" not found.`); return; }
            if (!confirm(`Delete profile "${name}"? This cannot be undone.`)) return;
            await fetch(`/api/profiles/${name}`, { method: 'DELETE' });
            refreshProfiles();
          }} style={headerBtnStyle}>🗑 Delete Profile</button>}
          <button onClick={resetToDefaults} style={headerBtnStyle}>↺ Reset</button>
          <button onClick={() => setShowOnboarding(true)} style={headerBtnStyle}>? Help</button>
        </div>
      </header>

      {/* Step Navigation */}
      <nav style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 20px' }}>
        {steps.map((step, i) => (
          <button key={step} onClick={() => setActiveStep(i)} style={{
            padding: '10px 20px', border: 'none', borderBottom: activeStep === i ? '3px solid #2563eb' : '3px solid transparent',
            background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeStep === i ? 700 : 400,
            color: activeStep === i ? '#2563eb' : '#64748b',
          }}>
            {i + 1}. {step}
          </button>
        ))}
      </nav>

      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 20px', fontSize: 12 }}>{error}</div>}
      {warnings.length > 0 && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', padding: '6px 20px', fontSize: 11 }}>
          {warnings.map((w, i) => <div key={i} style={{ color: '#92400e' }}>⚠ {w}</div>)}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeStep <= 2 && (
          <InputPanel
            inputs={inputs}
            onChange={handleSetInputs}
            onCalculate={() => {}}
            loading={false}
            showSection={sectionMap[activeStep]}
          />
        )}

        {/* Right panel: step guidance */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {activeStep === 0 && (
            <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>📝 Step 1: Data Inputs</p>
              <p style={{ fontSize: 12, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                Enter country configuration, period settings, macroeconomic assumptions, population data,
                and service level data for both water supply and sanitation.
                Set coverage targets at milestone years.
              </p>
            </div>
          )}
          {activeStep === 1 && (
            <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>💰 Step 2: BAU & Costs</p>
              <p style={{ fontSize: 12, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                Enter unit costs for water supply and sanitation infrastructure, BAU investment data
                (budget allocations, planned investments), and technical parameters
                (asset life, treatment capacity, non-HH rates).
              </p>
            </div>
          )}
          {activeStep === 2 && (
            <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>🔧 Step 3: Interventions</p>
              <p style={{ fontSize: 12, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                Configure intervention parameters for collection efficiency, NRW reduction,
                capital efficiency, tariff reform, borrowing, and microfinance.
                Toggle interventions on/off and add custom interventions.
              </p>
            </div>
          )}
          {activeStep === 3 && (
            <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>📊 Step 4: Outputs</p>
              <p style={{ fontSize: 12, maxWidth: 500, margin: '0 auto', lineHeight: 1.6, marginBottom: 24 }}>
                Charts, tables, and scenario analysis will be available in the full version of the tool.
                For now, you can export your input data:
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={async () => {
                  const res = await fetch('/api/export/csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'wss_results.csv'; a.click();
                }} style={exportBtnStyle}>📥 Export CSV</button>
                <button onClick={async () => {
                  const res = await fetch('/api/export/xlsx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'wss_results.xlsx'; a.click();
                }} style={exportBtnStyle}>📊 Export Excel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'use' | 'model'>('use');
  const tBtn = (t: 'use' | 'model', label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: '6px 16px', border: 'none', borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
      background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 700 : 400,
      color: tab === t ? '#2563eb' : '#64748b',
    }}>{label}</button>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 640, width: '92%', maxHeight: '85vh', overflowY: 'auto', padding: '24px 32px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, color: '#002244', marginBottom: 2 }}>Project WSS — Data Entry Tool</h2>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Water supply and sanitation strategic scenarios data collection</p>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
          {tBtn('use', 'How to Use')}{tBtn('model', 'About the Model')}
        </div>

        {tab === 'use' && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { step: '1', title: 'Data Inputs', desc: 'Set country, period, macroeconomic assumptions, population, current service levels, and coverage targets.', icon: '📝' },
              { step: '2', title: 'BAU & Costs', desc: 'Enter unit costs for infrastructure, BAU investment data (budget allocations, planned investments), and technical parameters.', icon: '💰' },
              { step: '3', title: 'Interventions', desc: 'Configure parameters for collection efficiency, NRW reduction, capital efficiency, tariff reform, borrowing, and microfinance. Add custom interventions.', icon: '🔧' },
              { step: '4', title: 'Outputs', desc: 'Export your data as CSV or Excel. Charts and scenario analysis will be available in the full version.', icon: '📊' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>{s.icon}</div>
                <div>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', margin: '0 0 2px' }}>Step {s.step}: {s.title}</h3>
                  <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 10, color: '#475569' }}>
            <strong>Tips:</strong>
            <ul style={{ margin: '4px 0 0 14px', padding: 0, lineHeight: 1.7 }}>
              <li>Hover over any ⓘ icon for field description</li>
              <li>Red borders = out of range; Yellow banner = invalid combinations</li>
              <li>Load country profiles or start blank for a new country</li>
              <li>All percentage groups that must sum to 100% are validated automatically</li>
            </ul>
          </div>
        </>}

        {tab === 'model' && <>
          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
            This data entry tool collects all inputs needed for the WSS Strategic Scenarios Simulation.
            The model estimates the investment needed to achieve water and sanitation coverage targets,
            identifies the financing gap, and models how policy interventions can close that gap.
          </p>
          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, marginTop: 8 }}>
            The calculation engine processes your inputs through: population projection → service level classification →
            BAU forecasting → target setting → gap calculation → intervention impact assessment.
          </p>
          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, marginTop: 8 }}>
            Once data entry is complete, results will be generated in the full version showing
            coverage trajectory charts, financing gap analysis, intervention impact breakdowns,
            and scenario comparisons.
          </p>
        </>}

        <button onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '10px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {tab === 'use' ? 'Get Started' : 'Close'}
        </button>
      </div>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
  background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 11,
};
const exportBtnStyle: React.CSSProperties = {
  padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 6,
  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600,
};
