"""
Sector BAU calculation — Excel WS sheet sections 4a-4d, generalised so the same
engine runs for Water Supply or Sanitation.

Rungs (JMP ladder), index order:
    0 = Safely managed   1 = Basic   2 = Limited   3 = Unimproved   4 = No Service

`sector_bau()` is the shared 4a-4d core. `calculate_water_supply()` wires the water
inputs into it; `calculate_sanitation()` (in sanitation.py) wires the sanitation inputs.

NOTE: sanitation is currently run through the SAME water-supply BAU structure with
sanitation inputs (different service levels, targets, costs, budget %, planned spend).
That already produces a distinct sanitation BAU; the sanitation-specific divergences
(on-site / FSM / sewered, fecal-sludge treatment sizing) await the sanitation sheet spec.
"""

import numpy as np

RUNGS = ["Safely managed", "Basic", "Limited", "Unimproved", "No Service"]
LOWER = [2, 3, 4]   # Limited, Unimproved, No Service


def weighted_cost(techs):
    """Weighted unit cost of a rung's technology mix: Σ(share × cost)."""
    return sum(t.share * t.cost for t in techs)


def cost_with_treatment(uc):
    """Weighted safely-managed connection cost (G263/G291): Σ(share × cost) over the SM mix."""
    return weighted_cost(uc.sm_technologies)


def cost_no_treatment(uc):
    """Weighted basic-rung cost (G271/G301): Σ(share × cost) over the Basic mix."""
    return weighted_cost(uc.basic_technologies)


def sector_full_budget(ctx, *, budget_pct, direct_series, direct_ongoing, mode):
    """The sector's FULL budget per year in real terms (millions).

    mode='pct_gdp'  -> real GDP × budget% (workbook default).
    mode='direct'   -> the entered actual-expenditure series (real terms), used as-is where given
                       and COMPOUNDED at the sector's own ongoing growth rate beyond the hard values.
                       Only forecast years feed the calc (history is zeroed by the `active` flag)."""
    n = ctx['n']
    if mode == 'direct':
        a = np.array(direct_series, dtype=float) if direct_series else np.array([], dtype=float)
        out = np.zeros(n, dtype=float)
        k = min(len(a), n)
        out[:k] = a[:k]
        g = float(direct_ongoing or 0.0)
        for t in range(k, n):
            out[t] = out[t - 1] * (1.0 + g)
        return out
    return np.asarray(ctx['gdp_real_local'], dtype=float) * float(budget_pct or 0.0)


def _planned_annual(planned_list, years, baseline_year, target2_year):
    """J162 — G331 = SUM of ALL planned-investment buckets (all five periods, 2026-2050),
    spread evenly over the forecast window (target2 - baseline) years. The sheet deliberately
    spreads the full 25-year plan total across the 15 forecast years."""
    total = sum(planned_list)
    span = max(1, target2_year - baseline_year)
    annual = total / span
    return np.array([annual if int(y) > baseline_year else 0.0 for y in years], dtype=float)


def sector_bau(ctx, *, period, pct_start, pct_base, tgt1, tgt2, cost_sm, cost_basic,
               full_budget, capex_pct, growth_capex_pct, planned_list, nonhh_pct, asset_life, capex_adder,
               hist_all_proportional, target_adjusted, execution_rate=1.0):
    """Shared 4a-4d core. All HH and money values are in MILLIONS; costs in actual currency.

    `full_budget` is the sector's FULL budget per year in real terms, from EITHER %GDP mode
    (GDP_real × budget%) OR direct entry (actual expenditure series). The BAU INVESTMENT that drives
    the model = the capex budget (full_budget × capex_pct) = `bau_available`, for BOTH sectors. The BAU
    additional safely-managed HH each year (4a) =
        (BAU investment − replacement capex) × HH/(HH+non-HH) ÷ SM cost
    so replacement (depreciation of the existing stock) is funded first, and only the household share
    buys new connections. `growth_capex_pct` and `planned_list` are kept for the caller signature but
    are no longer used. NOTE: this deliberately DIVERGES from the reference workbook's BAU (which grew
    SM on the %GDP capex budget alone); the 4d investment-need / financing-gap formulas are unchanged."""
    n, bi, years, total_hh = ctx['n'], ctx['bi'], ctx['years'], ctx['total_hh']
    msy, by = period.model_start_year, period.baseline_year
    t1y, t2y = period.target1_year, period.target2_year
    eay = ctx['end_asis_year']

    nonhh_mult = nonhh_pct / (1.0 - nonhh_pct) if nonhh_pct < 1.0 else 0.0
    active = np.maximum(ctx['forecast_flag'], ctx['perf_flag'])
    full_budget = np.asarray(full_budget, dtype=float)
    # Execution rate scales ALLOCATED capex down to what is actually SPENT (%GDP mode). At 1.0 this
    # is a no-op, reproducing the pre-execution-rate results.
    exec_rate = float(execution_rate)
    capex_budget = active * full_budget * capex_pct * exec_rate                      # capex actually spent
    planned_annual = np.zeros(n)                                                     # planned investment removed from the model
    bau_available = capex_budget                                                     # BAU investment = the capex budget
    # Display-only series (ALL years, unmasked by the active flag): the allocated capex the formula
    # implies each year, and the actual capex after execution. The engine only *spends* in forecast
    # years (active), but these rows show the %GDP × GDP × %capex figure the user entered.
    allocated_capex = full_budget * capex_pct
    actual_capex = allocated_capex * exec_rate

    # Historical CAGR per rung (on HH counts, start -> baseline)
    n_hist = by - msy
    hh_s, hh_b = total_hh[0], total_hh[bi]
    cagr = []
    for r in range(5):
        a, b = pct_start[r] * hh_s, pct_base[r] * hh_b
        cagr.append(((b / a) ** (1.0 / n_hist) - 1.0) if (a > 0 and b > 0 and n_hist > 0) else 0.0)

    # 4a — BAU forecast
    bau = np.zeros((5, n))
    # Historical block (2011..baseline): the sheet does NOT interpolate %s linearly. Each rung's
    # UNADJUSTED count grows geometrically from its 2011 count at the rung's historical CAGR
    # (X186: 2011# × (1+CAGR)^t, 2011# = start% × total_HH[2011]); then the ADJUSTED counts
    # (X193:197, the displayed series) rescale to that year's total HHs exactly like 4a:
    # SM kept, lower rungs × (total/Σ-all-5-unadjusted), Basic = plug. The two coincide at 2011
    # and (because the CAGR is calibrated to hit total×baseline%) at the baseline year.
    base0 = [pct_start[r] * total_hh[0] for r in range(5)]
    for t in range(bi + 1):
        unadj = [base0[r] * (1.0 + cagr[r]) ** t for r in range(5)]     # I!136-140 = 2011# × (1+CAGR)^t
        total_unadj = sum(unadj)                                        # I!141
        scale = total_hh[t] / total_unadj if total_unadj > 0 else 0.0
        if hist_all_proportional:                                      # WATER I!143-147: every rung × total/Σunadj
            for r in range(5):
                bau[r, t] = unadj[r] * scale
        else:                                                          # SANITATION I!193-197: SM kept, lower
            for r in LOWER:                                            # proportional, Basic = plug
                bau[r, t] = unadj[r] * scale
            bau[0, t] = unadj[0]
            bau[1, t] = total_hh[t] - unadj[0] - sum(bau[r, t] for r in LOWER)
    # Forecast keeps a SELF-CONTAINED unadjusted series (sheet r36-40): each rung compounds from its
    # OWN prior unadjusted value (NOT the rescaled/adjusted prior), seeded at the baseline from the
    # adjusted baseline counts. SM accumulates the budget-funded increase; the others grow at CAGR.
    # The adjusted row (r45-49) is then derived each year: SM kept, lower × total/Σunadj, Basic = plug.
    # 4b prep — target COUNTS at T1 / T2 (independent of the BAU path)
    eai = int(eay - msy)
    t1i, t2i = int(t1y - msy), int(t2y - msy)
    tc1 = [total_hh[t1i] * tgt1[r] for r in range(5)]
    tc2 = [total_hh[t2i] * tgt2[r] for r in range(5)]
    ny1, ny2 = t1y - eay, t2y - t1y

    # 4c — opening asset stock (booked at the baseline year)
    opening_stock = (bau[0, bi] * cost_sm + bau[1, bi] * cost_basic) * (1.0 + nonhh_mult)

    # BAU forecast (4a), targets (4b) and investment need (4d) are computed together in ONE forward
    # pass, because the BAU additional safely-managed HH depend on the BAU replacement capex:
    #     additional HH = (BAU investment − BAU replacement) × HH-share ÷ SM cost
    # BAU investment = bau_available (capex budget); BAU replacement = prior-year BAU-OWN asset stock ×
    # depreciation (performance-improvement years only); HH-share = HH/(HH+non-HH) = 1 − non-HH%. The BAU
    # stock is kept separate from the target `stock` so the BAU never depends on the target (no circularity).
    depr = 1.0 / asset_life
    hh_share = 1.0 - nonhh_pct
    tgt_unadj = np.zeros((5, n)); tgt = np.zeros((5, n))
    hh_gap = np.zeros(n); new_capex_total = np.zeros(n); stock = np.zeros(n)
    replacement = np.zeros(n); total_need = np.zeros(n); financing_gap = np.zeros(n)
    # BAU's OWN asset stock + its depreciation, kept SEPARATE from `stock` (which accumulates the
    # target-gap capex nc_total). The BAU 4a replacement depreciates THIS, so the BAU counterfactual
    # never depends on the target path — this fixes the cross-scenario circularity.
    bau_stock = np.zeros(n); bau_replacement = np.zeros(n)

    # History (start..baseline): target = BAU; the opening stock is booked at the baseline year.
    for t in range(bi + 1):
        tgt_unadj[:, t] = bau[:, t]; tgt[:, t] = bau[:, t]
        booked = opening_stock if years[t] == by else 0.0
        stock[t] = booked + (stock[t - 1] if t > 0 else 0.0)
        bau_stock[t] = booked + (bau_stock[t - 1] if t > 0 else 0.0)

    unadj = [bau[r, bi] for r in range(5)]                              # forecast SM accumulates on the baseline count
    cg1 = cg2 = None
    for t in range(bi + 1, n):
        ff, pf = ctx['forecast_flag'][t], ctx['perf_flag'][t]
        prior_stock = stock[t - 1]
        # Depreciation starts the FIRST forecast year (baseline+1, e.g. 2026), matching excel2 — which
        # depreciates the existing stock from baseline+1, NOT the later performance-improvement year (2028).
        replacement[t] = prior_stock * depr if ff > 0 else 0.0        # TARGET-stock depreciation → 4d only
        # 4a — additional safely-managed HH funded by (BAU investment − replacement), household share only.
        # BAU replacement depreciates the BAU's OWN stock (baseline existing stock + BAU's own additions),
        # NOT the target-gap stock — so the BAU counterfactual is independent of the target path.
        bau_replacement[t] = bau_stock[t - 1] * depr if ff > 0 else 0.0
        new_sm = max(0.0, bau_available[t] - bau_replacement[t]) * hh_share / cost_sm if cost_sm > 0 else 0.0
        unadj[0] = unadj[0] + new_sm                                   # r34: prior unadj SM + increase
        for r in range(1, 5):
            unadj[r] = unadj[r] * (1.0 + cagr[r])                      # r37-40: prior unadj × (1+CAGR)
        total_unadj = sum(unadj)                                       # r41
        scale = total_hh[t] / total_unadj if total_unadj > 0 else 0.0  # r43/r41
        for r in LOWER:                                                # r47-49 = unadj × (r43/r41)
            bau[r, t] = unadj[r] * scale
        bau[0, t] = unadj[0]                                           # r45 SM = unadj
        bau[1, t] = total_hh[t] - unadj[0] - sum(bau[r, t] for r in LOWER)  # r46 Basic = plug
        # BAU stock roll-forward (final workbook C|Urban Water r29 = X29 + budget − replacement): the
        # existing stock DEPRECIATES and the FULL capex budget is added each year — so an underfunded
        # sector (budget < replacement) sees the stock, and next year's replacement, DECLINE. Independent
        # of the target path (driven by bau_available / bau_replacement, not the target-gap stock).
        bau_stock[t] = bau_stock[t - 1] - bau_replacement[t] + bau_available[t]

        # 4b — target path: = BAU through end-of-as-is, then CAGR to T1 then T2 (adjusted block)
        if years[t] <= eay:
            tgt_unadj[:, t] = bau[:, t]; tgt[:, t] = bau[:, t]
        else:
            if cg1 is None:                                            # branch off the (new) BAU at end-of-as-is
                branch = [bau[r, eai] for r in range(5)]
                cg1 = [((tc1[r] / branch[r]) ** (1.0 / ny1) - 1.0) if branch[r] > 0 and ny1 > 0 else 0.0 for r in range(5)]
                cg2 = [((tc2[r] / tc1[r]) ** (1.0 / ny2) - 1.0) if tc1[r] > 0 and ny2 > 0 else 0.0 for r in range(5)]
            chosen = [cg1[r] if years[t] <= t1y else cg2[r] for r in range(5)]
            for r in range(5):
                tgt_unadj[r, t] = tgt_unadj[r, t - 1] * (1.0 + chosen[r])
            if not target_adjusted:
                for r in range(5):
                    tgt[r, t] = tgt_unadj[r, t]
            else:
                # Adjusted block: SM = unadjusted, Basic = plug (or total−SM when the lower rungs hit 0),
                # lower rungs = (total − SM − Basic) × prior-year adjusted lower shares.
                sm = tgt_unadj[0, t]
                rest = sum(tgt_unadj[r, t] for r in range(1, 5))
                basic = (total_hh[t] - sm) if rest == 0.0 else tgt_unadj[1, t]
                remaining = total_hh[t] - sm - basic
                prior_lower = [tgt[r, t - 1] for r in LOWER]
                psum = sum(prior_lower)
                for j, r in enumerate(LOWER):
                    tgt[r, t] = remaining * (prior_lower[j] / psum) if psum > 0 else 0.0
                tgt[0, t], tgt[1, t] = sm, basic

        # 4d — investment need & financing gap (formulas UNCHANGED; only the BAU inputs differ)
        gap = max(0.0, tgt[0, t] - bau[0, t]); hh_gap[t] = gap
        nc_hh = (gap * cost_sm + capex_adder) if gap > 0 else 0.0
        nc_total = nc_hh * (1.0 + nonhh_mult); new_capex_total[t] = nc_total
        booked = opening_stock if years[t] == by else 0.0
        stock[t] = booked + prior_stock + nc_total
        total_need[t] = (nc_total + replacement[t]) if (ff > 0 or pf > 0) else 0.0
        shortfall = total_need[t] - bau_available[t]
        financing_gap[t] = shortfall if ((ff > 0 or pf > 0) and shortfall > 0) else 0.0

    return {
        'rungs': RUNGS,
        'cost_per_hh': cost_sm,
        'cost_basic': cost_basic,
        'hist_cagr': cagr,
        'capex_budget': capex_budget.tolist(),
        'allocated_capex': allocated_capex.tolist(),
        'actual_capex': actual_capex.tolist(),
        'execution_rate': exec_rate,
        'planned_annual': planned_annual.tolist(),
        'bau_available': bau_available.tolist(),
        'bau_hh': bau.tolist(),
        'target_hh': tgt.tolist(),
        'opening_stock': opening_stock,
        'household_gap': hh_gap.tolist(),
        'new_capex_total': new_capex_total.tolist(),
        'replacement_capex': replacement.tolist(),
        'bau_replacement_capex': bau_replacement.tolist(),
        'total_investment_need': total_need.tolist(),
        'financing_gap': financing_gap.tolist(),
    }


def calculate_water_supply(inputs, ctx):
    sl, wt, wc = inputs.water_service, inputs.water_targets, inputs.water_costs
    nrw = inputs.water_interventions
    b = inputs.wss_budget
    cost_sm = cost_with_treatment(wc)
    # WATER adder (G168 × G173 × G174 × G175): cost × treatment%capex × current-NRW% × physical-loss%
    capex_adder = cost_sm * nrw.nrw_treatment_cost_pct_capex * nrw.nrw_current_pct * nrw.nrw_physical_loss_pct
    full_budget = sector_full_budget(ctx, budget_pct=b.ws_budget_pct_gdp,
        direct_series=b.ws_budget_direct, direct_ongoing=b.ws_budget_direct_ongoing, mode=b.budget_input_mode)
    # Water capex share of the water budget (workbook G321 = 0.21); falls back to the shared capex%.
    ws_capex = b.ws_capex_pct if b.ws_capex_pct is not None else b.capex_pct_budget
    res = sector_bau(
        ctx, period=inputs.period,
        pct_start=[sl.pct_serv1_start, sl.pct_serv2_start, sl.pct_serv3_start, sl.pct_serv4_start, sl.pct_serv5_start],
        pct_base=[sl.pct_serv1_baseline, sl.pct_serv2_baseline, sl.pct_serv3_baseline, sl.pct_serv4_baseline, sl.pct_serv5_baseline],
        tgt1=[wt.target1_serv1, wt.target1_serv2, wt.target1_serv3, wt.target1_serv4, wt.target1_serv5],
        tgt2=[wt.target2_serv1, wt.target2_serv2, wt.target2_serv3, wt.target2_serv4, wt.target2_serv5],
        cost_sm=cost_sm, cost_basic=cost_no_treatment(wc),
        full_budget=full_budget, capex_pct=ws_capex,
        growth_capex_pct=ws_capex,                             # water 4a uses the water CAPEX budget (I!326)
        hist_all_proportional=True,                            # water history I!143-147 = all-proportional
        target_adjusted=True,                                  # water targets use the adjusted block r129-133
        planned_list=inputs.planned_investments.ws_planned,
        nonhh_pct=inputs.technical.ws_non_hh_pct, asset_life=inputs.technical.ws_asset_life,
        capex_adder=capex_adder,
        # Execution rate applies only in %GDP mode; in direct mode the entered series is already the
        # actual spend, so execution is 1.0 (no double-count).
        execution_rate=(b.execution_rate if b.budget_input_mode == 'pct_gdp' else 1.0),
    )
    res['sector'] = 'water'
    return res
