"""
Sanitation BAU — provisional.

Runs the sanitation inputs through the shared 4a-4d core (`water_supply.sector_bau`).
This already yields a sanitation BAU distinct from water (different service levels,
targets, costs, budget %, planned spend). The sanitation-specific divergences
(on-site / FSM / sewered, fecal-sludge treatment sizing, microfinance) are pending
the sanitation sheet spec — there is no NRW concept here, so the new-capex adder is 0.
"""

from .water_supply import sector_bau, sector_full_budget, cost_with_treatment, cost_no_treatment


def calculate_sanitation(inputs, ctx):
    sl, st, sc = inputs.sanitation_service, inputs.sanitation_targets, inputs.sanitation_costs
    b = inputs.wss_budget
    cost_sm = cost_with_treatment(sc)
    # 4d adder (sheet r178 = gap*cost + G166*(treat%*NRW%*phys%)). Unlike water — which multiplies the
    # COST (r179 = ...+G168*factors ≈ 7,750) — sanitation multiplies G166 = I!G174 = the BASELINE SM
    # HOUSEHOLD COUNT (total_hh[baseline] × baseline SM %), so the adder is negligible (~0.006), NOT
    # cost-based. The factors (0.4×0.4×0.5=0.08) still read the water NRW cells.
    nrw = inputs.water_interventions
    san_sm_baseline = ctx['total_hh'][ctx['bi']] * sl.pct_sserv1_baseline
    capex_adder = san_sm_baseline * nrw.nrw_treatment_cost_pct_capex * nrw.nrw_current_pct * nrw.nrw_physical_loss_pct
    full_budget = sector_full_budget(ctx, budget_pct=b.san_budget_pct_gdp,
        direct_series=b.san_budget_direct, direct_ongoing=b.san_budget_direct_ongoing, mode=b.budget_input_mode)
    res = sector_bau(
        ctx, period=inputs.period,
        pct_start=[sl.pct_sserv1_start, sl.pct_sserv2_start, sl.pct_sserv3_start, sl.pct_sserv4_start, sl.pct_sserv5_start],
        pct_base=[sl.pct_sserv1_baseline, sl.pct_sserv2_baseline, sl.pct_sserv3_baseline, sl.pct_sserv4_baseline, sl.pct_sserv5_baseline],
        tgt1=[st.target1_sserv1, st.target1_sserv2, st.target1_sserv3, st.target1_sserv4, st.target1_sserv5],
        tgt2=[st.target2_sserv1, st.target2_sserv2, st.target2_sserv3, st.target2_sserv4, st.target2_sserv5],
        cost_sm=cost_sm, cost_basic=cost_no_treatment(sc),
        full_budget=full_budget, capex_pct=b.capex_pct_budget,
        growth_capex_pct=1.0,   # sanitation 4a SM growth uses the FULL budget (I!317, no capex factor)
        hist_all_proportional=False,  # sanitation history I!193-197 = SM kept / Basic plug / lower proportional
        # Sanitation's FINAL target rows (r128-132, which feed the % rows r136-140 and the outputs)
        # apply the SAME adjusted block as water (r129-133): SM = unadjusted, Basic = plug when the
        # unadjusted lower rungs hit 0, lower rungs share the remainder by prior-year adjusted shares.
        # r120-124 are only the intermediate raw-CAGR series the block reads from.
        target_adjusted=True,
        planned_list=inputs.planned_investments.san_planned,
        nonhh_pct=inputs.technical.san_non_hh_pct, asset_life=inputs.technical.san_asset_life,
        capex_adder=capex_adder,
        # Shared execution rate (%GDP mode only); direct mode is already actual spend, so 1.0.
        execution_rate=(b.execution_rate if b.budget_input_mode == 'pct_gdp' else 1.0),
    )
    res['sector'] = 'sanitation'
    return res
