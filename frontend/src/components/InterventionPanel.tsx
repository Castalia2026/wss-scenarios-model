import React, { useState } from 'react';
import { InterventionImpactChart } from './StaticCharts';

function Section({ title, children, defaultOpen = false, sectionKey, onFocus }: { title: string; children: React.ReactNode; defaultOpen?: boolean; sectionKey?: string; onFocus?: (key: string) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const handleClick = () => { const willOpen = !open; setOpen(willOpen); if (willOpen && sectionKey && onFocus) onFocus(sectionKey); };
  return (
    <div style={{ marginBottom: 8, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
      <button onClick={handleClick} style={{
        width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        {title}<span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={{ padding: '10px 14px 12px' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '10px 0 6px', borderBottom: '1px solid #e5e7eb', paddingBottom: 3 }}>{text}</div>;
}

function F({ label, value, onChange, unit, step, isPercent, tip, fieldType }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean; tip?: string; fieldType?: 'input' | 'linked' | 'computed';
}) {
  const rawPct = Math.round(value * 1e4) / 1e2;
  const displayVal = isPercent ? (fieldType === 'computed' ? Math.round(rawPct * 100) / 100 : rawPct) : Math.round(value * 100) / 100;
  const labelColor = fieldType === 'linked' ? '#16a34a' : fieldType === 'computed' ? '#94a3b8' : '#0000cc';
  return (
    <div style={{
      flex: '1 1 calc(50% - 6px)', minWidth: 150, maxWidth: 'calc(50% - 6px)',
      padding: '6px 8px', borderRadius: 6,
      background: fieldType === 'computed' ? '#f1f5f9' : fieldType === 'linked' ? '#f0fdf4' : '#f8fafc',
      border: '1px solid #e5e7eb',
    }}>
      <label style={{ display: 'block', fontSize: 11, color: labelColor, lineHeight: 1.3, marginBottom: 4, fontWeight: fieldType === 'computed' ? 400 : 500 }} title={tip || undefined}>
        {label}
        {unit && <span style={{ color: '#94a3b8', fontWeight: 400 }}> ({unit})</span>}
        {tip && <span style={{ color: '#2563eb', marginLeft: 3, fontSize: 12, fontWeight: 700, cursor: 'help' }} title={tip}>ⓘ</span>}
      </label>
      <input type="number" value={displayVal}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
        step={isPercent ? 1 : (step || 1)}
        readOnly={fieldType === 'computed' || fieldType === 'linked'}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 4, fontSize: 14, textAlign: 'left',
          border: fieldType === 'computed' ? '1px solid #94a3b8' : '1px solid #ccc',
          background: fieldType === 'computed' ? '#e2e8f0' : fieldType === 'linked' ? '#e8f5e9' : '#fff',
          color: fieldType === 'computed' ? '#475569' : '#000',
          boxSizing: 'border-box',
        }} />
    </div>
  );
}

// Toggle with inline expand for parameters
function InterventionToggle({ label, checked, onChange, children, onFocus }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; onFocus?: () => void;
}) {
  return (
    <div style={{ marginBottom: 8, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer',
        background: checked ? '#eef2ff' : '#fafbfc', borderBottom: checked ? '1px solid #c7d2fe' : 'none',
      }} onClick={() => { if (!checked && onFocus) onFocus(); }}>
        <input type="checkbox" checked={checked} onChange={e => { onChange(e.target.checked); if (e.target.checked && onFocus) onFocus(); }}
          style={{ width: 18, height: 18, accentColor: '#2563eb' }} />
        <span style={{ fontSize: 13, color: checked ? '#1e3a5f' : '#94a3b8', fontWeight: checked ? 600 : 400, flex: 1 }}>{label}</span>
        {checked && <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>▾ Configure</span>}
      </label>
      {checked && (
        <div style={{ padding: '10px 14px', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          {children}
        </div>
      )}
    </div>
  );
}

interface Props { inputs: any; onChange: (i: any) => void; sectorTab?: 'water' | 'sanitation'; onSectorChange?: (v: 'water' | 'sanitation') => void; onSectionFocus?: (key: string) => void; }

export default function InterventionPanel({ inputs, onChange, sectorTab = 'water', onSectorChange, onSectionFocus }: Props) {
  const u = (section: string, field: string, value: number) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
  };
  const CUR = inputs?.country_config?.currency || 'LCU';

  return (
    <div style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
      {/* Left: intervention controls */}
      <div style={{ width: 480, overflowY: 'auto', padding: '16px 20px', background: '#fafbfc', borderRight: '1px solid #e0e0e0', fontSize: 12 }}>

        {/* Sector toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['water', 'sanitation'] as const).map(s => (
            <button key={s} onClick={() => { onSectorChange?.(s); onSectionFocus?.(s === 'water' ? 'ws_interventions' : 'san_interventions'); }} style={{
              flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: sectorTab === s ? '#2563eb' : '#e5e7eb',
              color: sectorTab === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 13,
            }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
          ))}
        </div>

        {/* ===== WATER SUPPLY INTERVENTIONS ===== */}
        {sectorTab === 'water' && <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>Water Supply Interventions</h3>

          <InterventionToggle label="Collection efficiency" checked={inputs.toggles?.ws_collection_efficiency_enabled ?? true} onChange={v => toggleIntv('ws_collection_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.ce_start_year} onChange={v => u('water_interventions','ce_start_year',v)} tip="Year the intervention begins" />
            <F label="Target year" value={inputs.water_interventions.ce_target_year} onChange={v => u('water_interventions','ce_target_year',v)} tip="Year the target is achieved" />
            <F label="Current collection ratio" value={inputs.water_interventions.ce_current_ratio} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" />
            <F label="Target collection ratio" value={inputs.water_interventions.ce_target_ratio} onChange={v => u('water_interventions','ce_target_ratio',v)} isPercent unit="%" />
            <F label="Water volume sold" value={inputs.water_interventions.ce_water_sold_mld} onChange={v => u('water_interventions','ce_water_sold_mld',v)} unit="MLD" />
            <F label="Current tariff" value={inputs.water_interventions.ce_current_tariff} onChange={v => u('water_interventions','ce_current_tariff',v)} unit={`${CUR}/m3`} />
          </InterventionToggle>

          <InterventionToggle label="NRW reduction" checked={inputs.toggles?.ws_nrw_enabled ?? true} onChange={v => toggleIntv('ws_nrw_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.nrw_start_year} onChange={v => u('water_interventions','nrw_start_year',v)} />
            <F label="Target year" value={inputs.water_interventions.nrw_target_year} onChange={v => u('water_interventions','nrw_target_year',v)} />
            <F label="Current NRW %" value={inputs.water_interventions.nrw_current_pct} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" />
            <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" tip="Minimum 3%" />
            {(() => {
              const t = inputs.water_interventions.nrw_target_pct || 0;
              if (t > 0 && t < 0.03) return <div style={{ width: '100%', fontSize: 10, fontWeight: 600, color: '#dc2626', padding: '3px 8px', background: '#fef2f2', borderRadius: 4, marginBottom: 4 }}>⛔ Below 3% is unrealistic</div>;
              if (t >= 0.03 && t < 0.07) return <div style={{ width: '100%', fontSize: 10, fontWeight: 600, color: '#92400e', padding: '3px 8px', background: '#fef3c7', borderRadius: 4, marginBottom: 4 }}>⚠ 3–7% is highly ambitious</div>;
              return null;
            })()}
            <F label="Commercial losses % of NRW" value={inputs.water_interventions.nrw_commercial_loss_pct || 0} onChange={v => u('water_interventions','nrw_commercial_loss_pct',v)} isPercent unit="%" tip="Commercial + physical must sum to 100%" />
            <F label="Physical losses % of NRW" value={inputs.water_interventions.nrw_physical_loss_pct || 0} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" />
            <F label="Capex unit cost NRW reduction" value={inputs.water_interventions.nrw_capex_unit_cost_usd || 0} onChange={v => u('water_interventions','nrw_capex_unit_cost_usd',v)} step={10} unit="USD/m3/day" />
            <F label="Lag to benefits" value={inputs.water_interventions.nrw_lag_years} onChange={v => u('water_interventions','nrw_lag_years',v)} unit="yrs" />
            <F label="Year of maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex_year || 0} onChange={v => u('water_interventions','nrw_maintenance_capex_year',v)} />
            <F label="Maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex || 0} onChange={v => u('water_interventions','nrw_maintenance_capex',v)} step={10} unit={`${CUR} M`} />
          </InterventionToggle>

          <InterventionToggle label="Capital expenditure efficiency" checked={inputs.toggles?.ws_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} />
            <F label="Efficiency gains" value={inputs.water_interventions.capeff_gains_pct} onChange={v => u('water_interventions','capeff_gains_pct',v)} isPercent unit="%" tip="Typically 10–30%" />
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.ws_tariff_enabled ?? true} onChange={v => toggleIntv('ws_tariff_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} />
            <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} />
            <F label="Monthly income bottom 20%" value={inputs.water_interventions.tariff_monthly_income_bottom20 || 0} onChange={v => u('water_interventions','tariff_monthly_income_bottom20',v)} step={100} unit={CUR} />
            <F label="Max % income on water" value={inputs.water_interventions.tariff_max_pct_income_water} onChange={v => u('water_interventions','tariff_max_pct_income_water',v)} isPercent unit="%" />
            <F label="Current operating revenue" value={inputs.water_interventions.tariff_op_revenue || 0} onChange={v => u('water_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} />
            <F label="Current operating expenditure" value={inputs.water_interventions.tariff_op_expenditure || 0} onChange={v => u('water_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} />
            <F label="Current O&M ratio (calculated)" value={(inputs.water_interventions.tariff_op_revenue && inputs.water_interventions.tariff_op_expenditure) ? Math.round(inputs.water_interventions.tariff_op_revenue / inputs.water_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" />
            <F label="O&M recovery target" value={inputs.water_interventions.tariff_om_recovery_target} onChange={v => u('water_interventions','tariff_om_recovery_target',v)} step={0.1} />
          </InterventionToggle>

          <InterventionToggle label="Borrowing against future cashflow" checked={inputs.toggles?.ws_borrowing_enabled ?? true} onChange={v => toggleIntv('ws_borrowing_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.loan_start_year} onChange={v => u('water_interventions','loan_start_year',v)} />
            <F label="End year" value={inputs.water_interventions.loan_end_year} onChange={v => u('water_interventions','loan_end_year',v)} />
            <F label="Avg cost per water produced" value={inputs.water_interventions.loan_avg_cost || 0} onChange={v => u('water_interventions','loan_avg_cost',v)} step={0.1} unit={`${CUR}/m3`} />
            <F label="DSCR" value={inputs.water_interventions.loan_dscr} onChange={v => u('water_interventions','loan_dscr',v)} step={0.1} />
            <F label="Grace period" value={inputs.water_interventions.loan_grace_years} onChange={v => u('water_interventions','loan_grace_years',v)} unit="yrs" />
            <F label="Tenor" value={inputs.water_interventions.loan_tenor} onChange={v => u('water_interventions','loan_tenor',v)} unit="yrs" />
            <F label="Interest rate" value={inputs.water_interventions.loan_interest_rate} onChange={v => u('water_interventions','loan_interest_rate',v)} isPercent unit="%" />
            <F label="Year of investment" value={inputs.water_interventions.loan_investment_year || 0} onChange={v => u('water_interventions','loan_investment_year',v)} />
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.ws_budget_execution_enabled ?? false} onChange={v => toggleIntv('ws_budget_execution_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.budget_exec_start_year || 0} onChange={v => u('water_interventions','budget_exec_start_year',v)} />
            <F label="Current execution rate (calculated)" value={inputs.water_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" />
            <F label="Target execution rate" value={inputs.water_interventions.budget_exec_target_rate || 0} onChange={v => u('water_interventions','budget_exec_target_rate',v)} isPercent unit="%" />
          </InterventionToggle>
        </>}

        {/* ===== SANITATION INTERVENTIONS ===== */}
        {sectorTab === 'sanitation' && <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>Sanitation Interventions</h3>

          <InterventionToggle label="Collection efficiency" checked={inputs.toggles?.san_collection_enabled ?? true} onChange={v => toggleIntv('san_collection_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} />
            <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} />
            <F label="Sewer tariff as % of water tariff" value={inputs.sanitation_interventions.ce_sewer_tariff_pct_water || 0} onChange={v => u('sanitation_interventions','ce_sewer_tariff_pct_water',v)} isPercent unit="%" tip="Collection ratios inherited from water supply" />
          </InterventionToggle>

          <InterventionToggle label="Capital expenditure efficiency" checked={inputs.toggles?.san_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} />
            <F label="Efficiency gains" value={inputs.sanitation_interventions.capeff_gains_pct} onChange={v => u('sanitation_interventions','capeff_gains_pct',v)} isPercent unit="%" />
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.san_tariff_enabled ?? true} onChange={v => toggleIntv('san_tariff_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} />
            <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} />
            <F label="Max % income on sanitation" value={inputs.sanitation_interventions.tariff_max_pct_income_san} onChange={v => u('sanitation_interventions','tariff_max_pct_income_san',v)} isPercent unit="%" />
            <F label="Tariff real growth rate" value={inputs.sanitation_interventions.san_tariff_growth_rate || 0} onChange={v => u('sanitation_interventions','san_tariff_growth_rate',v)} isPercent unit="%" />
            <F label="Current operating revenue" value={inputs.sanitation_interventions.tariff_op_revenue || 0} onChange={v => u('sanitation_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} />
            <F label="Current operating expenditure" value={inputs.sanitation_interventions.tariff_op_expenditure || 0} onChange={v => u('sanitation_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} />
            <F label="Current O&M ratio (calculated)" value={(inputs.sanitation_interventions.tariff_op_revenue && inputs.sanitation_interventions.tariff_op_expenditure) ? Math.round(inputs.sanitation_interventions.tariff_op_revenue / inputs.sanitation_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" />
            <F label="O&M recovery target" value={inputs.sanitation_interventions.tariff_om_recovery_target || 0} onChange={v => u('sanitation_interventions','tariff_om_recovery_target',v)} step={0.1} />
          </InterventionToggle>

          <InterventionToggle label="Borrowing against future cashflow" checked={inputs.toggles?.san_borrowing_enabled ?? true} onChange={v => toggleIntv('san_borrowing_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.loan_start_year} onChange={v => u('sanitation_interventions','loan_start_year',v)} />
            <F label="End year" value={inputs.sanitation_interventions.loan_end_year} onChange={v => u('sanitation_interventions','loan_end_year',v)} />
            <F label="Avg cost per wastewater billed" value={inputs.sanitation_interventions.loan_avg_cost || 0} onChange={v => u('sanitation_interventions','loan_avg_cost',v)} step={0.1} unit={`${CUR}/m3`} />
            <F label="DSCR" value={inputs.sanitation_interventions.loan_dscr} onChange={v => u('sanitation_interventions','loan_dscr',v)} step={0.1} />
            <F label="Grace period" value={inputs.sanitation_interventions.loan_grace_years || 0} onChange={v => u('sanitation_interventions','loan_grace_years',v)} unit="yrs" />
            <F label="Tenor" value={inputs.sanitation_interventions.loan_tenor || 0} onChange={v => u('sanitation_interventions','loan_tenor',v)} unit="yrs" />
            <F label="Interest rate" value={inputs.sanitation_interventions.loan_interest_rate} onChange={v => u('sanitation_interventions','loan_interest_rate',v)} isPercent unit="%" />
            <F label="Year of investment" value={inputs.sanitation_interventions.loan_investment_year || 0} onChange={v => u('sanitation_interventions','loan_investment_year',v)} />
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.san_budget_execution_enabled ?? false} onChange={v => toggleIntv('san_budget_execution_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.budget_exec_start_year || 0} onChange={v => u('sanitation_interventions','budget_exec_start_year',v)} />
            <F label="Current execution rate (calculated)" value={inputs.sanitation_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" />
            <F label="Target execution rate" value={inputs.sanitation_interventions.budget_exec_target_rate || 0} onChange={v => u('sanitation_interventions','budget_exec_target_rate',v)} isPercent unit="%" />
          </InterventionToggle>

          <InterventionToggle label="Microfinance for on-site sanitation" checked={inputs.toggles?.san_microfinance_enabled ?? false} onChange={v => toggleIntv('san_microfinance_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.mf_start_year || 0} onChange={v => u('sanitation_interventions','mf_start_year',v)} />
            <F label="End year" value={inputs.sanitation_interventions.mf_end_year || 0} onChange={v => u('sanitation_interventions','mf_end_year',v)} />
            <F label="Facility cost" value={inputs.sanitation_interventions.mf_onsite_cost || 0} onChange={v => u('sanitation_interventions','mf_onsite_cost',v)} step={1000} unit={CUR} />
            <F label="Interest rate" value={inputs.sanitation_interventions.mf_interest_rate || 0} onChange={v => u('sanitation_interventions','mf_interest_rate',v)} isPercent unit="%" />
            <F label="Tenor" value={inputs.sanitation_interventions.mf_tenor || 0} onChange={v => u('sanitation_interventions','mf_tenor',v)} unit="yrs" />
            <F label="Collection & emptying cost" value={inputs.sanitation_interventions.mf_collection_cost || 0} onChange={v => u('sanitation_interventions','mf_collection_cost',v)} step={500} unit={CUR} />
            <F label="Emptying frequency" value={inputs.sanitation_interventions.mf_emptying_frequency || 0} onChange={v => u('sanitation_interventions','mf_emptying_frequency',v)} unit="yrs" />
            <F label="Max % income on sanitation" value={inputs.sanitation_interventions.mf_max_pct_income || 0} onChange={v => u('sanitation_interventions','mf_max_pct_income',v)} isPercent unit="%" />
            <F label="Adoption rate" value={inputs.sanitation_interventions.mf_adoption_rate || 0} onChange={v => u('sanitation_interventions','mf_adoption_rate',v)} isPercent unit="%" />
          </InterventionToggle>
        </>}

        {/* ===== CUSTOM INTERVENTIONS (always visible) ===== */}
        <div style={{ marginTop: 16 }}>
          <Section title="Custom Interventions" sectionKey="custom_interventions" onFocus={onSectionFocus}>
            <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>
              Custom interventions are saved with your scenario. In the full tool, they will affect calculations.
            </div>
            {(inputs.custom_interventions || []).map((ci: any, idx: number) => {
              const updateCI = (field: string, val: any) => {
                const arr = [...inputs.custom_interventions];
                arr[idx] = { ...arr[idx], [field]: val };
                onChange({ ...inputs, custom_interventions: arr });
              };
              return (
                <div key={idx} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: '#faf5ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input type="color" value={ci.color || '#9333ea'} onChange={e => updateCI('color', e.target.value)}
                      style={{ width: 20, height: 20, border: 'none', cursor: 'pointer', borderRadius: 3 }} />
                    <input type="text" value={ci.name} onChange={e => updateCI('name', e.target.value)}
                      style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '3px 6px', fontSize: 12, fontWeight: 600 }} />
                    <button onClick={() => {
                      const arr = inputs.custom_interventions.filter((_: any, i: number) => i !== idx);
                      onChange({ ...inputs, custom_interventions: arr });
                    }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: '#64748b' }}>Sector</label>
                      <select value={ci.sector} onChange={e => updateCI('sector', e.target.value)}
                        style={{ width: '100%', padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 10, background: '#fff' }}>
                        <option value="water">Water Supply</option>
                        <option value="sanitation">Sanitation</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: '#64748b' }}>Type</label>
                      <select value={ci.intervention_type} onChange={e => updateCI('intervention_type', e.target.value)}
                        style={{ width: '100%', padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 10, background: '#fff' }}>
                        <option value="fixed_annual">Fixed Annual Amount</option>
                        <option value="revenue_stream">Revenue Stream</option>
                        <option value="per_hh_subsidy">Per-HH Subsidy</option>
                      </select>
                    </div>
                  </div>
                  <F label="Start year" value={ci.start_year} onChange={v => updateCI('start_year', v)} />
                  <F label="End year" value={ci.end_year} onChange={v => updateCI('end_year', v)} />
                  {ci.intervention_type === 'fixed_annual' && (
                    <F label="Annual amount (mill)" value={ci.annual_amount} onChange={v => updateCI('annual_amount', v)} step={100} />
                  )}
                  {ci.intervention_type === 'revenue_stream' && (<>
                    <F label="Starting amount (mill)" value={ci.starting_amount} onChange={v => updateCI('starting_amount', v)} step={100} />
                    <F label="Growth rate" value={ci.growth_rate} onChange={v => updateCI('growth_rate', v)} isPercent unit="%" />
                  </>)}
                  {ci.intervention_type === 'per_hh_subsidy' && (
                    <F label="Subsidy per HH" value={ci.subsidy_per_hh} onChange={v => updateCI('subsidy_per_hh', v)} step={1000} />
                  )}
                </div>
              );
            })}
            <button onClick={() => {
              const existing = inputs.custom_interventions || [];
              const colors = ['#9333ea','#f97316','#06b6d4','#84cc16','#f43f5e'];
              onChange({ ...inputs, custom_interventions: [...existing, {
                name: 'New Intervention', enabled: true, sector: 'water', intervention_type: 'fixed_annual',
                start_year: 2028, end_year: 2035, annual_amount: 1000, starting_amount: 500,
                growth_rate: 0.05, subsidy_per_hh: 10000, color: colors[existing.length % colors.length],
              }] });
            }} style={{ width: '100%', padding: '8px', border: '1px dashed #9333ea', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: '#9333ea', fontWeight: 500 }}>
              + Add Custom Intervention
            </button>
          </Section>
        </div>
      </div>

      {/* Right: intervention impact chart */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <InterventionImpactChart sector={sectorTab} />
      </div>
    </div>
  );
}
