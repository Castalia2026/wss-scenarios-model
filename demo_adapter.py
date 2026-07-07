"""
Demo adapter — bridges the demo frontend's (rich) input schema to the validated engine.

The React demo (frontend/src/components/InputPanel.tsx) reads a schema of its own:
budget under macro.*, inflation_nepal, per-year service-level time series (serv1_ts…),
per-service-level network costs, budget modes, and the five interventions. The validated
engine (model/) uses a leaner schema. Rather than rewrite the 900-line UI, this module:

  * FRONTEND_DEFAULTS — the shape the InputPanel expects, populated with the sheet-validated
    Kathmandu-Valley numbers, so /api/defaults renders a working, editable input sheet.
  * to_engine(fe) — translates that frontend shape into a model.inputs.ModelInputs for the
    engine's BAU (4a-4d). Interventions in the UI are carried but not yet computed.
"""
from model.inputs import (
    ModelInputs, PeriodInputs, Constants, MacroInputs, PopulationInputs,
    WaterServiceLevelInputs, SanitationServiceLevelInputs, WaterTargetInputs,
    SanitationTargetInputs, WaterUnitCosts, SanitationUnitCosts, Tech,
    PlannedInvestmentInputs, TechnicalInputs, WSSBudgetInputs,
    WaterInterventionInputs, SanitationInterventionInputs, CountryConfig,
)

# ── validated Kathmandu-Valley values (from the reference workbook) ──────────
# All series/scalars carry the workbook's FULL float precision (I|General Urban). Rounding these
# (even at the 5th-6th decimal) shifts every money output by ~1e-5 relative — visibly off Excel.
_GDP_USD = [21.685,21.703,22.162,22.722,24.361,24.524,28.972,33.112,34.186,33.434,36.927,41.183,40.907,43.419,46.08,49.603,54.449,59.728,65.494,71.783]
_INFL_LOCAL = [0.096,0.083,0.099,0.09,0.078,0.099,0.045,0.041,0.046,0.061,0.036,0.064,0.077,0.054,0.049,0.05,0.051,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05]
_INFL_US = [0.031,0.021,0.015,0.016,0.001,0.013,0.021,0.024,0.018,0.013,0.047,0.08,0.041,0.03,0.03,0.025,0.021,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022,0.022]
_FX = [74.5973698630137,85.4278961748633,93.6310410958903,97.62424657534244,102.61506849315076,107.48286885245902,104.19501369863016,109.41323287671237,112.63893150684937,118.55868493150682,118.2669863013699,125.73810958904113,132.1363561643834,133.86980874316944]
_POP = [2.423388,2.477757119096809,2.533346018563647,2.5901820643791393,2.6482932364822645,2.707708142546658,2.768456032063945,2.830566810743036,2.8940710552324713,2.959000028173066,3.0253856935882634,3.0932607326197694,3.1626585596162253,3.233613338582828]
_HH = [0.61,0.6292760000000001,0.6491611216000001,0.6696746130425602,0.6908363308147051,0.7126667588684498,0.7351870284486929,0.7584189385476716,0.7823849770057781,0.8071083422791607,0.8326129658951823,0.8589235356174701,0.8860655193429823,0.9140651897542206]
_WS_START = [0.56560166762623,0.3403983323737703,0.026,0.058,0.01]
_WS_BASE  = [0.513729462650536,0.386270537349464,0.032,0.059,0.009]
_WS_T1 = [0.66,0.34,0,0,0]
_WS_T2 = [1,0,0,0,0]
_SAN_START = [0.0288,0.97,0.0001,0.001,0.0001]
_SAN_BASE  = [0.07774752344348565,0.909252476556514,0.008,0.003,0.002]
_SAN_T1 = [0.66,0.34,0,0,0]
_SAN_T2 = [1,0,0,0,0]
_WS_COST_SM, _WS_COST_BASIC = 96878.0, 86875.59308914324
_SAN_COST_SM = 105050.23373368701
_WS_BUDGET_PCT, _SAN_BUDGET_PCT = 0.0016496186144332283, 0.0004178609445049989
# GDP-derived real budget 2011-2030 (real GDP x %GDP) — the seamless direct-entry default.
_WS_BUDGET_DIRECT = [6499.543652769706, 6878.455752682857, 7004.910275298227, 6869.917578680842, 7181.824137317749, 6890.668861747498, 7551.61681596089, 8706.00809507662, 8846.447991197832, 8582.986824519227, 9127.766789271474, 10171.857267441954, 9858.69894610241, 10058.228475636557, 10363.749934479772, 10884.000000000005, 11701.58672000642, 12559.776877555345, 13475.800452242762, 14451.860633584014]
_SAN_BUDGET_DIRECT = [1646.3838525069891, 1742.3651699877457, 1774.3970625686513, 1740.2023855589002, 1819.210689689914, 1745.4588434250131, 1912.8819883870049, 2205.2980814154935, 2240.872575499119, 2174.135857699329, 2312.132767183153, 2576.6088282191704, 2497.2834430727976, 2547.825790824143, 2625.2167006027853, 2757.0, 2964.100935966343, 3181.487031552744, 3413.522771667886, 3660.7662409767645]
_START_YR, _BASE_YR, _END_YR = 2011, 2025, 2040
_NYEARS = _END_YR - _START_YR + 1                       # 30
_BASE_IDX = _BASE_YR - _START_YR                        # 14


def _svc_series(start, base):
    """A per-year service-share series the UI can show: linear start→baseline over history,
    held flat over the forecast. The engine only reads index 0 (start) and the baseline index —
    those two are kept at FULL precision (rounding them breaks Excel parity); only the
    display-only interpolated years in between are rounded."""
    out = []
    for i in range(_NYEARS):
        if i == 0:
            out.append(start)
        elif i >= _BASE_IDX:
            out.append(base)
        else:
            f = i / _BASE_IDX
            out.append(round(start * (1 - f) + base * f, 6))
    return out


def frontend_defaults() -> dict:
    """The frontend-shaped default inputs (what InputPanel.tsx reads), with validated values."""
    return {
        'country_config': {
            'country': 'Nepal', 'area': 'Kathmandu Valley', 'currency': 'NPR',
            'ws_serv1_name': 'Safely managed', 'ws_serv2_name': 'Basic', 'ws_serv3_name': 'Limited',
            'ws_serv4_name': 'Unimproved', 'ws_serv5_name': 'No service',
            'san_serv1_name': 'Safely managed', 'san_serv2_name': 'Basic', 'san_serv3_name': 'Limited',
            'san_serv4_name': 'Unimproved', 'san_serv5_name': 'No service',
            'provider1_name': 'Provider 1', 'provider2_name': 'Provider 2',
        },
        'period': {
            'model_start_year': _START_YR, 'baseline_year': _BASE_YR, 'forecast_end_year': _END_YR,
            'perf_improvement_start_year': 2028, 'target1_year': 2030, 'target2_year': 2040,
            'as_is_forecast_start': 2026, 'as_is_forecast_length': 2,
        },
        'macro': {
            'ws_budget_pct_gdp': _WS_BUDGET_PCT, 'san_budget_pct_gdp': _SAN_BUDGET_PCT,
            'capex_pct_budget': 0.21,
            'execution_rate': 1.0,
            'budget_input_mode': 'pct_gdp',
            'gdp_nominal_usd': _GDP_USD,                      # hard values only; tail projected at growth
            'inflation_nepal': _INFL_LOCAL, 'inflation_us': _INFL_US, 'exchange_rate': _FX,
            'inflation_local_ongoing': 0.05, 'inflation_us_ongoing': 0.022,
            'gdp_growth_forecast': 0.05, 'real_price_year': 2025,
        },
        'population': {'pop_ts': _POP, 'hh_ts': _HH,
                       'total_pop_start': _POP[0], 'total_hh_start': _HH[0],
                       'total_pop_baseline': None, 'total_hh_baseline': None},
        'water_service': {f'serv{i+1}_ts': _svc_series(_WS_START[i], _WS_BASE[i]) for i in range(5)},
        'sanitation_service': {f'sserv{i+1}_ts': _svc_series(_SAN_START[i], _SAN_BASE[i]) for i in range(5)},
        'water_targets': {**{f'target1_serv{i+1}': _WS_T1[i] for i in range(5)},
                          **{f'target2_serv{i+1}': _WS_T2[i] for i in range(5)},
                          'providers': [], 'planned_treatment_capacity_mld': 510.0},
        'sanitation_targets': {**{f'target1_sserv{i+1}': _SAN_T1[i] for i in range(5)},
                               **{f'target2_sserv{i+1}': _SAN_T2[i] for i in range(5)},
                               'onsite_collection_treatment_pct': 0.0},
        'water_costs': {'network_cost_per_hh_serv1': _WS_COST_SM, 'network_cost_per_hh_serv2': _WS_COST_BASIC,
                        'network_cost_per_hh_serv3': 0.0, 'network_cost_per_hh_serv4': 0.0,
                        'ws_cost_per_mld_treatment': 0.0, 'dug_well_cost': 52713.0,
                        'borehole_cost': 400000.0, 'hh_treatment_system_cost': 8000.0,
                        # technology-mix calculators (Test Harness tab): weighted Σ(share×cost) is
                        # written through to the serv1/serv2 cost fields the engine consumes.
                        'sm_tech_mix': [
                            {'name': 'Piped network', 'share': 0.65, 'cost': 105388.31832439502},
                            {'name': 'Protected well', 'share': 0.15, 'cost': 60000.0},
                            {'name': 'Water tanker', 'share': 0.10, 'cost': 96878.0},
                            {'name': 'Borehole + handpump', 'share': 0.10, 'cost': 96877.9308914323}],
                        'basic_tech_mix': [
                            {'name': 'Piped network', 'share': 0.65, 'cost': 90000.0},
                            {'name': 'Protected well', 'share': 0.15, 'cost': 60000.0},
                            {'name': 'Water tanker', 'share': 0.10, 'cost': 96878.0},
                            {'name': 'Borehole + handpump', 'share': 0.10, 'cost': 96877.9308914323}]},
        'sanitation_costs': {'sewer_cost_per_hh_sserv1': _SAN_COST_SM, 'sewer_cost_per_hh_sserv2': _SAN_COST_SM,
                             'sewer_cost_per_hh_sserv3': 14600.0, 'sewer_cost_per_hh_sserv4': 16500.0,
                             'san_cost_per_mld_treatment': 0.0, 'onsite_facility_capex': 83000.0,
                             'cost_per_mld_fst': 395.0,
                             'sm_tech_mix': [
                                 {'name': 'Piped / network', 'share': 0.6570, 'cost': 117290.76671794064},
                                 {'name': 'Septic tank', 'share': 0.3360, 'cost': 83000.0},
                                 {'name': 'Pit latrine', 'share': 0.0060, 'cost': 14600.0},
                                 {'name': 'VIP latrine', 'share': 0.0, 'cost': 16500.0},
                                 {'name': 'Pit + slab', 'share': 0.0010, 'cost': 14600.0},
                                 {'name': 'Composting', 'share': 0.0, 'cost': 22000.0}],
                             'basic_tech_mix': [
                                 {'name': 'Piped / network', 'share': 0.6570, 'cost': 117290.76671794064},
                                 {'name': 'Septic tank', 'share': 0.3360, 'cost': 83000.0},
                                 {'name': 'Pit latrine', 'share': 0.0060, 'cost': 14600.0},
                                 {'name': 'VIP latrine', 'share': 0.0, 'cost': 16500.0},
                                 {'name': 'Pit + slab', 'share': 0.0010, 'cost': 14600.0},
                                 {'name': 'Composting', 'share': 0.0, 'cost': 22000.0}]},
        'bau': {'budget_input_mode': 'pct_gdp',
                # actual-expenditure defaults = the GDP-derived real budget (2011-2030). With the 5%
                # ongoing growth (= real GDP growth) these reproduce %GDP mode exactly, so flipping the
                # switch is seamless; the user then edits the spent numbers.
                'ws_budget_ts': list(_WS_BUDGET_DIRECT), 'san_budget_ts': list(_SAN_BUDGET_DIRECT),
                'ws_expend_ts': list(_WS_BUDGET_DIRECT), 'san_expend_ts': list(_SAN_BUDGET_DIRECT),
                'ws_budget_ongoing': 0.05, 'san_budget_ongoing': 0.05,
                'period_mode': 'custom', 'period_unit_years': 5,
                # the workbook's five 5-year Investment-Plan buckets (I!326-330 / I!338-342)
                'investment_periods': [
                    {'start': 2026, 'end': 2030, 'ws_inv': 16223.765355365464, 'san_inv': 17000.0, 'is_custom': True},
                    {'start': 2031, 'end': 2035, 'ws_inv': 14005.46734156549,  'san_inv': 12000.0, 'is_custom': True},
                    {'start': 2036, 'end': 2040, 'ws_inv': 9306.350838959635,  'san_inv': 11000.0, 'is_custom': True},
                    {'start': 2041, 'end': 2045, 'ws_inv': 4817.250716358515,  'san_inv': 7000.0,  'is_custom': True},
                    {'start': 2046, 'end': 2050, 'ws_inv': 2717.0869163112056, 'san_inv': 5000.0,  'is_custom': True},
                ]},
        'technical': {'ws_asset_life': 30, 'ws_non_hh_pct': 0.10, 'ws_existing_treatment_mld': 117.0,
                      'ws_water_req_who_lpcd': 135, 'san_asset_life': 30, 'san_non_hh_pct': 0.10,
                      'san_wastewater_factor': 0.8, 'san_existing_fst_mld': 0.0, 'san_fs_per_person_per_day': 1.0,
                      'san_avg_capex_per_mld_fstp': 395},
        'water_interventions': _default_ws_intervention(),
        'sanitation_interventions': _default_san_intervention(),
        'toggles': {k: False for k in [
            'ws_collection_enabled','ws_nrw_enabled','ws_capital_efficiency_enabled','ws_tariff_enabled',
            'ws_borrowing_enabled','ws_budget_execution_enabled','san_collection_enabled',
            'san_capital_efficiency_enabled','san_tariff_enabled','san_borrowing_enabled','san_budget_execution_enabled']},
        'custom_interventions': [],
    }


def _default_ws_intervention():
    return {'ce_start_year':2026,'ce_target_year':2035,'ce_current_ratio':0.90,'ce_target_ratio':0.95,
            'ce_water_sold_mld':87.6,'ce_current_tariff':32.0,
            'nrw_start_year':2026,'nrw_target_year':2035,'nrw_current_pct':0.40,'nrw_target_pct':0.25,
            'nrw_treatment_cost_pct_capex':0.40,
            'nrw_commercial_loss_pct':0.5,'nrw_physical_loss_pct':0.5,'nrw_capex_unit_cost_usd':500,'nrw_lag_years':1,
            'capeff_start_year':2026,'capeff_gains_pct':0.20,
            'tariff_start_year':2026,'tariff_target_year':2035,'tariff_monthly_income_bottom20':15000,
            'tariff_max_pct_income_water':0.05,'tariff_om_recovery_target':1.5,
            'loan_start_year':2026,'loan_end_year':2035,'loan_avg_cost':30,'loan_dscr':1.2,
            'loan_grace_years':3,'loan_tenor':15,'loan_interest_rate':0.08}


def _default_san_intervention():
    return {'ce_start_year':2026,'ce_target_year':2035,'ce_sewer_tariff_pct_water':0.5,
            'capeff_start_year':2026,'capeff_gains_pct':0.20,
            'tariff_start_year':2026,'tariff_target_year':2035,'tariff_max_pct_income_san':0.05,
            'san_tariff_growth_rate':0.03,'tariff_om_recovery_target':1.5,
            'loan_start_year':2026,'loan_end_year':2035,'loan_avg_cost':30,'loan_dscr':1.2,
            'loan_grace_years':3,'loan_tenor':15,'loan_interest_rate':0.08,
            'mf_start_year':2026,'mf_end_year':2035,'mf_onsite_cost':83000,'mf_interest_rate':0.12,'mf_tenor':5}


def _g(d, *path, default=None):
    for p in path:
        if not isinstance(d, dict):
            return default
        d = d.get(p)
    return d if d is not None else default


def _at(series, idx, default=0.0):
    return series[idx] if series and 0 <= idx < len(series) else default


def coerce_to_engine(inputs: dict) -> ModelInputs:
    """Accept EITHER shape and return a ModelInputs.

    The bau-test harness posts ENGINE-shaped inputs (wss_budget, water_costs.sm_technologies,
    water_service.pct_serv1_start, macro.inflation_local); the demo posts FRONTEND-shaped inputs
    (budget under macro.*, water_costs.network_cost_per_hh_*, water_service.serv1_ts,
    macro.inflation_nepal). Frontend markers are checked FIRST so demo-side additions (e.g. the
    tech-mix calculator fields) can never flip a demo payload into the engine path."""
    macro = inputs.get('macro') or {}
    ws = inputs.get('water_service') or {}
    if 'inflation_nepal' in macro or 'serv1_ts' in ws:
        return to_engine(inputs)                # frontend-shaped (demo) -> adapt
    wc = inputs.get('water_costs') or {}
    if 'wss_budget' in inputs or 'sm_technologies' in wc or 'technologies' in wc or 'pct_serv1_start' in ws:
        return ModelInputs(**inputs)            # engine-shaped (standalone harness)
    return to_engine(inputs)


def to_engine(fe: dict) -> ModelInputs:
    """Translate the frontend-shaped inputs into a ModelInputs for the validated engine (BAU)."""
    per = fe.get('period', {})
    msy = per.get('model_start_year', _START_YR)
    bi = int(per.get('baseline_year', _BASE_YR) - msy)
    macro = fe.get('macro', {})

    period = PeriodInputs(
        model_start_year=msy, baseline_year=per.get('baseline_year', _BASE_YR),
        forecast_end_year=per.get('forecast_end_year', _END_YR),
        as_is_forecast_start=per.get('as_is_forecast_start', per.get('baseline_year', _BASE_YR) + 1),
        as_is_forecast_length=per.get('as_is_forecast_length', 2),
        target1_year=per.get('target1_year', 2030), target2_year=per.get('target2_year', 2040),
    )

    m = MacroInputs(
        gdp_nominal_usd=macro.get('gdp_nominal_usd', []),
        gdp_growth_forecast=macro.get('gdp_growth_forecast', 0.05),
        inflation_local=macro.get('inflation_nepal', macro.get('inflation_local', [])),
        inflation_local_ongoing=macro.get('inflation_local_ongoing', 0.05),
        inflation_us=macro.get('inflation_us', []),
        inflation_us_ongoing=macro.get('inflation_us_ongoing', 0.022),
        exchange_rate=macro.get('exchange_rate', []),
    )

    pop = fe.get('population', {})
    population = PopulationInputs(pop_ts=pop.get('pop_ts', []), hh_ts=pop.get('hh_ts', []))

    wsv = fe.get('water_service', {})
    ws_serv = WaterServiceLevelInputs(**{
        **{f'pct_serv{i+1}_start': _at(wsv.get(f'serv{i+1}_ts', []), 0) for i in range(5)},
        **{f'pct_serv{i+1}_baseline': _at(wsv.get(f'serv{i+1}_ts', []), bi) for i in range(5)},
    })
    ssv = fe.get('sanitation_service', {})
    san_serv = SanitationServiceLevelInputs(**{
        **{f'pct_sserv{i+1}_start': _at(ssv.get(f'sserv{i+1}_ts', []), 0) for i in range(5)},
        **{f'pct_sserv{i+1}_baseline': _at(ssv.get(f'sserv{i+1}_ts', []), bi) for i in range(5)},
    })

    wt = fe.get('water_targets', {})
    ws_tgt = WaterTargetInputs(**{k: wt.get(k, 0.0) for k in
        [f'target1_serv{i+1}' for i in range(5)] + [f'target2_serv{i+1}' for i in range(5)]})
    st = fe.get('sanitation_targets', {})
    san_tgt = SanitationTargetInputs(**{k: st.get(k, 0.0) for k in
        [f'target1_sserv{i+1}' for i in range(5)] + [f'target2_sserv{i+1}' for i in range(5)]})

    wc = fe.get('water_costs', {})
    ws_costs = WaterUnitCosts(
        sm_technologies=[Tech(name='Weighted', share=1.0, cost=wc.get('network_cost_per_hh_serv1', _WS_COST_SM))],
        basic_technologies=[Tech(name='Weighted', share=1.0, cost=wc.get('network_cost_per_hh_serv2', _WS_COST_BASIC))])
    sc = fe.get('sanitation_costs', {})
    san_costs = SanitationUnitCosts(
        sm_technologies=[Tech(name='Weighted', share=1.0, cost=sc.get('sewer_cost_per_hh_sserv1', _SAN_COST_SM))],
        basic_technologies=[Tech(name='Weighted', share=1.0, cost=sc.get('sewer_cost_per_hh_sserv2', _SAN_COST_SM))])

    # planned investments: sum the frontend's investment periods into a single bucket each sector
    periods = _g(fe, 'bau', 'investment_periods', default=[]) or []
    ws_planned = [round(sum(float(p.get('ws_inv', 0) or 0) for p in periods), 4)] or [0.0]
    san_planned = [round(sum(float(p.get('san_inv', 0) or 0) for p in periods), 4)] or [0.0]
    planned = PlannedInvestmentInputs(ws_planned=ws_planned, san_planned=san_planned)

    tech = fe.get('technical', {})
    technical = TechnicalInputs(
        ws_asset_life=int(tech.get('ws_asset_life', 30)), ws_non_hh_pct=tech.get('ws_non_hh_pct', 0.10),
        san_asset_life=int(tech.get('san_asset_life', 30)), san_non_hh_pct=tech.get('san_non_hh_pct', 0.10),
    )
    bau = fe.get('bau', {}) or {}
    budget = WSSBudgetInputs(
        ws_budget_pct_gdp=macro.get('ws_budget_pct_gdp', _WS_BUDGET_PCT),
        san_budget_pct_gdp=macro.get('san_budget_pct_gdp', _SAN_BUDGET_PCT),
        capex_pct_budget=macro.get('capex_pct_budget', 0.21),
        # Shared budget execution rate (%GDP mode): actual capex = allocated × this. Default 1.0.
        execution_rate=macro.get('execution_rate', 1.0),
        # direct-entry budget: 'actual expenditure' series drives the model (real terms, full budget)
        budget_input_mode=macro.get('budget_input_mode', bau.get('budget_input_mode', 'pct_gdp')),
        ws_budget_direct=bau.get('ws_expend_ts', []) or [],
        san_budget_direct=bau.get('san_expend_ts', []) or [],
        ws_budget_direct_ongoing=bau.get('ws_budget_ongoing', 0.05),
        san_budget_direct_ongoing=bau.get('san_budget_ongoing', 0.05),
    )
    # NRW factors (feed the 4d capex adder; sanitation reads the same water cells)
    wi = fe.get('water_interventions', {}) or {}
    ws_intv = WaterInterventionInputs(
        nrw_treatment_cost_pct_capex=wi.get('nrw_treatment_cost_pct_capex', 0.40),
        nrw_current_pct=wi.get('nrw_current_pct', 0.40),
        nrw_physical_loss_pct=wi.get('nrw_physical_loss_pct', 0.50),
    )

    return ModelInputs(
        country_config=CountryConfig(**{k: v for k, v in fe.get('country_config', {}).items()
                                        if k in CountryConfig.model_fields}),
        period=period, constants=Constants(), macro=m, population=population,
        water_service=ws_serv, sanitation_service=san_serv,
        water_targets=ws_tgt, sanitation_targets=san_tgt,
        water_costs=ws_costs, sanitation_costs=san_costs,
        planned_investments=planned, technical=technical,
        water_interventions=ws_intv, sanitation_interventions=SanitationInterventionInputs(),
        wss_budget=budget,
    )
