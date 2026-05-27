import React, { useState } from 'react';
import { InterventionImpactChart } from './StaticCharts';

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6, border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 12, borderRadius: 6, display: 'flex', justifyContent: 'space-between',
      }}>{title}<span>{open ? '▾' : '▸'}</span></button>
      {open && <div style={{ padding: '6px 12px 10px' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '8px 0 4px', borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}>{text}</div>;
}

function F({ label, value, onChange, unit, step, isPercent, tip, slider }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean; tip?: string; slider?: boolean;
}) {
  const displayVal = isPercent ? Math.round(value * 1e10) / 1e8 : value;
  return (
    <div style={{ marginBottom: slider ? 6 : 4 }} title={tip || ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500, cursor: tip ? 'help' : 'default' }}>
          {label}{tip && <span style={{ color: '#94a3b8', marginLeft: 3, fontSize: 9 }}>ⓘ</span>}
        </label>
        <input type="number" value={displayVal}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
          step={isPercent ? 1 : (step || 1)}
          style={{ width: slider ? 60 : 90, padding: '3px 5px', borderRadius: 3, fontSize: 11, textAlign: 'right', border: '1px solid #ccc' }} />
        {unit && <span style={{ fontSize: 10, color: '#888', minWidth: 24 }}>{unit}</span>}
      </div>
      {slider && <input type="range" value={displayVal} onChange={e => { const v = parseFloat(e.target.value); onChange(isPercent ? v / 100 : v); }}
        min={0} max={isPercent ? 100 : 100} step={isPercent ? 1 : (step || 1)}
        style={{ width: '100%', height: 6, marginTop: 2, accentColor: '#2563eb' }} />}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
      <span style={{ color: checked ? '#1a1a2e' : '#94a3b8', fontWeight: checked ? 600 : 400 }}>{label}</span>
    </label>
  );
}

interface Props { inputs: any; onChange: (i: any) => void; sectorTab?: 'water' | 'sanitation'; onSectorChange?: (v: 'water' | 'sanitation') => void; }

export default function InterventionPanel({ inputs, onChange, sectorTab = 'water', onSectorChange }: Props) {
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
      <div style={{ width: 420, overflowY: 'auto', padding: 12, background: '#fafbfc', borderRight: '1px solid #e0e0e0', fontSize: 11 }}>
        <h2 style={{ fontSize: 14, marginBottom: 10, color: '#1a1a2e' }}>Intervention Selection</h2>

        {/* Toggles */}
        <Section title="Enable/Disable Interventions">
          <SubHead text="Water Supply" />
          <Toggle label="Collection efficiency" checked={inputs.toggles?.ws_collection_efficiency_enabled ?? true} onChange={v => toggleIntv('ws_collection_efficiency_enabled', v)} />
          <Toggle label="NRW reduction" checked={inputs.toggles?.ws_nrw_enabled ?? true} onChange={v => toggleIntv('ws_nrw_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles?.ws_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles?.ws_tariff_enabled ?? true} onChange={v => toggleIntv('ws_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles?.ws_borrowing_enabled ?? true} onChange={v => toggleIntv('ws_borrowing_enabled', v)} />
          <Toggle label="Budget execution improvement" checked={inputs.toggles?.ws_budget_execution_enabled ?? false} onChange={v => toggleIntv('ws_budget_execution_enabled', v)} />
          <SubHead text="Sanitation" />
          <Toggle label="Collection efficiency" checked={inputs.toggles?.san_collection_enabled ?? true} onChange={v => toggleIntv('san_collection_enabled', v)} />
          <Toggle label="NRW reduction" checked={inputs.toggles?.san_nrw_enabled ?? false} onChange={v => toggleIntv('san_nrw_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles?.san_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles?.san_tariff_enabled ?? true} onChange={v => toggleIntv('san_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles?.san_borrowing_enabled ?? true} onChange={v => toggleIntv('san_borrowing_enabled', v)} />
          <Toggle label="Budget execution improvement" checked={inputs.toggles?.san_budget_execution_enabled ?? false} onChange={v => toggleIntv('san_budget_execution_enabled', v)} />
        </Section>

        {/* Water intervention parameters */}
        <Section title="Water Supply Parameters">
          <SubHead text="Collection efficiency" />
          <F label="Start year" value={inputs.water_interventions.ce_start_year} onChange={v => u('water_interventions','ce_start_year',v)} tip="Year the intervention begins" />
          <F label="Target year" value={inputs.water_interventions.ce_target_year} onChange={v => u('water_interventions','ce_target_year',v)} tip="Year the target is achieved" />
          <F label="Current collection ratio" value={inputs.water_interventions.ce_current_ratio} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" tip="Current fraction of billed amounts collected" />
          <F label="Target collection ratio" value={inputs.water_interventions.ce_target_ratio} onChange={v => u('water_interventions','ce_target_ratio',v)} isPercent unit="%" tip="Target collection ratio" />
          <F label="Water volume sold" value={inputs.water_interventions.ce_water_sold_mld} onChange={v => u('water_interventions','ce_water_sold_mld',v)} unit="MLD" tip="Total water supply volume sold" />
          <F label={`Current tariff (${CUR}/m3)`} value={inputs.water_interventions.ce_current_tariff} onChange={v => u('water_interventions','ce_current_tariff',v)} unit={CUR} tip="Current average water tariff" />

          <SubHead text="NRW reduction" />
          <F label="Start year" value={inputs.water_interventions.nrw_start_year} onChange={v => u('water_interventions','nrw_start_year',v)} />
          <F label="Target year" value={inputs.water_interventions.nrw_target_year} onChange={v => u('water_interventions','nrw_target_year',v)} />
          <F label="Current NRW %" value={inputs.water_interventions.nrw_current_pct} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" />
          <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" />
          <F label="Commercial losses as % of NRW" value={inputs.water_interventions.nrw_commercial_loss_pct || 0} onChange={v => u('water_interventions','nrw_commercial_loss_pct',v)} isPercent unit="%" tip="Commercial (non-physical) losses; commercial + physical must sum to 100%" />
          <F label="Physical losses as % of NRW" value={inputs.water_interventions.nrw_physical_loss_pct || 0} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" tip="Physical losses; commercial + physical must sum to 100%" />
          {(() => { const c = (inputs.water_interventions.nrw_commercial_loss_pct||0); const p = (inputs.water_interventions.nrw_physical_loss_pct||0); const s = c+p; const bad = s > 0 && Math.abs(s-1)>0.005; return bad ? <div style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', padding: '2px 8px', background: '#fef2f2', borderRadius: 4, marginBottom: 4 }}>Commercial + Physical = {Math.round(s*100)}% (must be 100%)</div> : null; })()}
          <F label="Capex unit cost NRW reduction" value={inputs.water_interventions.nrw_capex_unit_cost_usd || 0} onChange={v => u('water_interventions','nrw_capex_unit_cost_usd',v)} step={10} unit="USD" tip="Cost to reduce NRW by one unit (USD per m3/day)" />
          <F label="Lag to benefits" value={inputs.water_interventions.nrw_lag_years} onChange={v => u('water_interventions','nrw_lag_years',v)} unit="yrs" tip="Years between investment and realized improvement" />
          <F label="Year of maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex_year || 0} onChange={v => u('water_interventions','nrw_maintenance_capex_year',v)} tip="Year when maintenance capital expenditure occurs" />
          <F label={`Maintenance capex (${CUR} mill)`} value={inputs.water_interventions.nrw_maintenance_capex || 0} onChange={v => u('water_interventions','nrw_maintenance_capex',v)} step={10} unit={`${CUR} M`} tip="Maintenance capital expenditure amount" />
          <SubHead text="Capital efficiency" />
          <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} />
          <F label="Efficiency gains" value={inputs.water_interventions.capeff_gains_pct} onChange={v => u('water_interventions','capeff_gains_pct',v)} isPercent unit="%" />
          <SubHead text="Tariff reform" />
          <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} />
          <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} />
          <F label={`Monthly income bottom 20%`} value={inputs.water_interventions.tariff_monthly_income_bottom20 || 0} onChange={v => u('water_interventions','tariff_monthly_income_bottom20',v)} step={100} unit={CUR} />
          <F label={`Max % income on water`} value={inputs.water_interventions.tariff_max_pct_income_water} onChange={v => u('water_interventions','tariff_max_pct_income_water',v)} isPercent unit="%" />
          <F label="Current operating revenue" value={inputs.water_interventions.tariff_op_revenue || 0} onChange={v => u('water_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} tip="Annual operating revenue" />
          <F label="Current operating expenditure" value={inputs.water_interventions.tariff_op_expenditure || 0} onChange={v => u('water_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} tip="Annual operating expenditure" />
          <F label="Current O&M ratio (calculated)" value={(inputs.water_interventions.tariff_op_revenue && inputs.water_interventions.tariff_op_expenditure) ? Math.round(inputs.water_interventions.tariff_op_revenue / inputs.water_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" step={0.01} tip="Revenue / Expenditure" />
          <F label="O&M cost recovery target" value={inputs.water_interventions.tariff_om_recovery_target} onChange={v => u('water_interventions','tariff_om_recovery_target',v)} step={0.1} />
          <SubHead text="Borrowing" />
          <F label="Start year" value={inputs.water_interventions.loan_start_year} onChange={v => u('water_interventions','loan_start_year',v)} />
          <F label="End year" value={inputs.water_interventions.loan_end_year} onChange={v => u('water_interventions','loan_end_year',v)} />
          <F label="Avg cost per water produced" value={inputs.water_interventions.loan_avg_cost || 0} onChange={v => u('water_interventions','loan_avg_cost',v)} step={0.1} tip="Per m3" />
          <F label="DSCR" value={inputs.water_interventions.loan_dscr} onChange={v => u('water_interventions','loan_dscr',v)} step={0.1} />
          <F label="Grace period" value={inputs.water_interventions.loan_grace_years} onChange={v => u('water_interventions','loan_grace_years',v)} unit="yrs" />
          <F label="Tenor" value={inputs.water_interventions.loan_tenor} onChange={v => u('water_interventions','loan_tenor',v)} unit="yrs" />
          <F label="Interest rate" value={inputs.water_interventions.loan_interest_rate} onChange={v => u('water_interventions','loan_interest_rate',v)} isPercent unit="%" />
          <F label="Year of investment" value={inputs.water_interventions.loan_investment_year || 0} onChange={v => u('water_interventions','loan_investment_year',v)} tip="Year in which loan proceeds are invested" />
          <F label={`Loan cap (${CUR} mill)`} value={inputs.water_interventions.loan_cap || 0} onChange={v => u('water_interventions','loan_cap',v)} step={500} unit={`${CUR} M`} />
          <SubHead text="Budget execution improvement" />
          <F label="Start year" value={inputs.water_interventions.budget_exec_start_year || 0} onChange={v => u('water_interventions','budget_exec_start_year',v)} tip="Year budget execution improvement begins" />
          <F label="Current execution rate (calculated)" value={inputs.water_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Computed from historical data" />
          <F label="Target execution rate" value={inputs.water_interventions.budget_exec_target_rate || 0} onChange={v => u('water_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target execution rate" />
        </Section>

        {/* Sanitation intervention parameters */}
        <Section title="Sanitation Parameters">
          <SubHead text="Collection efficiency" />
          <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} />
          <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} />
          <F label="Sewer tariff as % of water tariff" value={inputs.sanitation_interventions.ce_sewer_tariff_pct_water || 0} onChange={v => u('sanitation_interventions','ce_sewer_tariff_pct_water',v)} isPercent unit="%" tip="Collection ratios inherited from water supply" />
          <SubHead text="Capital efficiency" />
          <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} />
          <F label="Efficiency gains" value={inputs.sanitation_interventions.capeff_gains_pct} onChange={v => u('sanitation_interventions','capeff_gains_pct',v)} isPercent unit="%" />
          <SubHead text="Tariff reform" />
          <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} />
          <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} />
          <F label={`Max % income on sanitation`} value={inputs.sanitation_interventions.tariff_max_pct_income_san} onChange={v => u('sanitation_interventions','tariff_max_pct_income_san',v)} isPercent unit="%" />
          <F label="Tariff real growth rate" value={inputs.sanitation_interventions.san_tariff_growth_rate || 0} onChange={v => u('sanitation_interventions','san_tariff_growth_rate',v)} isPercent unit="%" />
          <F label="Current operating revenue" value={inputs.sanitation_interventions.tariff_op_revenue || 0} onChange={v => u('sanitation_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} tip="Annual sanitation operating revenue" />
          <F label="Current operating expenditure" value={inputs.sanitation_interventions.tariff_op_expenditure || 0} onChange={v => u('sanitation_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} tip="Annual sanitation operating expenditure" />
          <F label="Current O&M ratio (calculated)" value={(inputs.sanitation_interventions.tariff_op_revenue && inputs.sanitation_interventions.tariff_op_expenditure) ? Math.round(inputs.sanitation_interventions.tariff_op_revenue / inputs.sanitation_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" step={0.01} tip="Revenue / Expenditure" />
          <F label="O&M recovery target" value={inputs.sanitation_interventions.tariff_om_recovery_target || 0} onChange={v => u('sanitation_interventions','tariff_om_recovery_target',v)} step={0.1} />
          <SubHead text="Borrowing" />
          <F label="Start year" value={inputs.sanitation_interventions.loan_start_year} onChange={v => u('sanitation_interventions','loan_start_year',v)} />
          <F label="End year" value={inputs.sanitation_interventions.loan_end_year} onChange={v => u('sanitation_interventions','loan_end_year',v)} />
          <F label="Avg cost per wastewater billed" value={inputs.sanitation_interventions.loan_avg_cost || 0} onChange={v => u('sanitation_interventions','loan_avg_cost',v)} step={0.1} tip="Per m3" />
          <F label="DSCR" value={inputs.sanitation_interventions.loan_dscr} onChange={v => u('sanitation_interventions','loan_dscr',v)} step={0.1} />
          <F label="Grace period" value={inputs.sanitation_interventions.loan_grace_years || 0} onChange={v => u('sanitation_interventions','loan_grace_years',v)} unit="yrs" />
          <F label="Tenor" value={inputs.sanitation_interventions.loan_tenor || 0} onChange={v => u('sanitation_interventions','loan_tenor',v)} unit="yrs" />
          <F label="Interest rate" value={inputs.sanitation_interventions.loan_interest_rate} onChange={v => u('sanitation_interventions','loan_interest_rate',v)} isPercent unit="%" />
          <F label="Year of investment" value={inputs.sanitation_interventions.loan_investment_year || 0} onChange={v => u('sanitation_interventions','loan_investment_year',v)} tip="Year in which loan proceeds are invested" />
          <F label={`Loan cap (${CUR} mill)`} value={inputs.sanitation_interventions.loan_cap || 0} onChange={v => u('sanitation_interventions','loan_cap',v)} step={500} unit={`${CUR} M`} />
          <SubHead text="Budget execution improvement" />
          <F label="Start year" value={inputs.sanitation_interventions.budget_exec_start_year || 0} onChange={v => u('sanitation_interventions','budget_exec_start_year',v)} tip="Year budget execution improvement begins" />
          <F label="Current execution rate (calculated)" value={inputs.sanitation_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Computed from historical data" />
          <F label="Target execution rate" value={inputs.sanitation_interventions.budget_exec_target_rate || 0} onChange={v => u('sanitation_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target execution rate" />
        </Section>

        {/* Custom interventions - editable but not connected to calculations */}
        <Section title="Custom Interventions">
          <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>
            Custom interventions can be defined here. In this prototype, they are saved with your scenario but do not affect the Results Dashboard calculations.
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
                    style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '2px 6px', fontSize: 11, fontWeight: 600 }} />
                  <button onClick={() => {
                    const arr = inputs.custom_interventions.filter((_: any, i: number) => i !== idx);
                    onChange({ ...inputs, custom_interventions: arr });
                  }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>Sector</label>
                    <select value={ci.sector} onChange={e => updateCI('sector', e.target.value)}
                      style={{ width: '100%', padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 10, background: '#fff', color: '#333' }}>
                      <option value="water">Water Supply</option>
                      <option value="sanitation">Sanitation</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>Type</label>
                    <select value={ci.intervention_type} onChange={e => updateCI('intervention_type', e.target.value)}
                      style={{ width: '100%', padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 10, background: '#fff', color: '#333' }}>
                      <option value="fixed_annual">Fixed Annual Amount</option>
                      <option value="revenue_stream">Revenue Stream</option>
                      <option value="per_hh_subsidy">Per-HH Subsidy</option>
                    </select>
                  </div>
                </div>
                <F label="Start year" value={ci.start_year} onChange={v => updateCI('start_year', v)} tip="Year this intervention begins" />
                <F label="End year" value={ci.end_year} onChange={v => updateCI('end_year', v)} tip="Year this intervention ends" />
                {ci.intervention_type === 'fixed_annual' && (
                  <F label="Annual amount (mill)" value={ci.annual_amount} onChange={v => updateCI('annual_amount', v)} step={100} tip="Fixed annual cash amount" />
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
          }} style={{ width: '100%', padding: '6px', border: '1px dashed #9333ea', borderRadius: 4, background: 'none', cursor: 'pointer', fontSize: 11, color: '#9333ea' }}>
            + Add Custom Intervention
          </button>
        </Section>
      </div>

      {/* Right: sector toggle + intervention impact chart */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {onSectorChange && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['water', 'sanitation'] as const).map(s => (
              <button key={s} onClick={() => onSectorChange(s)} style={{
                padding: '7px 18px', border: 'none', borderRadius: 5, cursor: 'pointer',
                background: sectorTab === s ? '#2563eb' : '#e5e7eb',
                color: sectorTab === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 12,
              }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
            ))}
          </div>
        )}
        <InterventionImpactChart />
      </div>
    </div>
  );
}
