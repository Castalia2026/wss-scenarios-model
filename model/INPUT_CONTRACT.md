# WSS Tool — Input Contract (reconciled)

**Source of truth:** the hardcoded "Input" (grey) cells of the Excel `I|General` sheets,
captured as 168 parameters with Urban and Rural values. Derived/formula cells are excluded.
This document is the canonical input contract that BOTH the data-entry UI and the calculation
engine must conform to. (Default *values* are illustrative — only the parameter list, units,
and structure are binding.)

## Cross-cutting structural decisions

1. **Per-area model.** The Excel `I|General` sheet exists once per area (Urban, Rural), each
   with its own full input set. The engine runs **once per area**; **National = Urban + Rural
   aggregate** (computed, not entered). This matches the UI's scope modes:
   - *Urban / Rural* mode → enter one or both area input sets; both → national aggregate.
   - *National* mode → a single national input set (used when no urban/rural split exists).
2. **Service levels = 2 points, not a time series.** Each sector's 5-level split is entered for
   the **start year (2011)** and the **baseline year (2025)** only; historical CAGR is derived
   from those two points. The current UI collects a full year-by-year table — keep it as a
   convenience, but the engine consumes **first historical = start** and **baseline-year = baseline**.
3. **Annual time series** (entered per year over the historical range): GDP growth, GDP nominal
   USD, local inflation, US inflation, exchange rate, total population, total households.
4. **Budget is driven by % of GDP**, not by entered year-by-year budget/expenditure. The
   `*_budget_ts` / `*_expend_ts` arrays and the "budget execution" intervention in the current UI
   are **NOT in the contract** → drop or treat as non-canonical extensions.
5. **Investments = five fixed 5-year periods** (2026-30, 2031-35, 2036-40, 2041-45, 2046-50),
   water and sanitation entered separately.

---

## 1. Constants & labels (universal — kept server-side, not user-entered per scenario)
| # | Parameter | Unit |
|---|---|---|
| 1-5 | Days in month (30), days in year (365), thousand, million, cubic meter (1000 L) | num |
| 6-8 | Country, Area (Urban/Rural), Local currency | name |
| 9-13 | Water service-level labels: Safely managed / Basic / Limited / Unimproved / No Service | label |
| 14-18 | Sanitation service-level labels (same five) | label |

## 2. Macroeconomics — **annual time series**
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 19 | Annual GDP growth (real) | % | `macro.gdp_growth[]` |
| 20 | GDP nominal | USD bn | `macro.gdp_nominal_usd[]` |
| 21 | Annual inflation (local) | % | `macro.inflation_local[]` (rename from `inflation_nepal`) |
| 22 | Annual inflation (US) | % | `macro.inflation_us[]` |
| 23 | Exchange rate (local per 1 USD) | LCU/USD | `macro.exchange_rate[]` |
| 24 | Total population | # people | `population.pop_ts[]` |
| 25 | Total households | # HH (millions) | `population.hh_ts[]` |

## 3. Service levels — **start year + baseline year** (per sector, 5 levels each)
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 26-30 | Water % HHs at 5 levels, **start year** | % | `water_service.pct_serv1..5_start` |
| 31-35 | Water % HHs at 5 levels, **baseline year** | % | `water_service.pct_serv1..5_baseline` |
| 36-40 | Sanitation % HHs at 5 levels, **start year** | % | `sanitation_service.pct_sserv1..5_start` |
| 41-45 | Sanitation % HHs at 5 levels, **baseline year** | % | `sanitation_service.pct_sserv1..5_baseline` |

## 4. Targets (per sector — Target 1 = 2030, Target 2 = 2040)
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 46-50 | Water Target 1, 5 levels | % | `water_targets.target1_serv1..5` |
| 51-55 | Water Target 2, 5 levels | % | `water_targets.target2_serv1..5` |
| 56 | Sanitation % on-site | % | `sanitation_targets.onsite_collection_treatment_pct` |
| 57-61 | Sanitation Target 1, 5 levels | % | `sanitation_targets.target1_sserv1..5` |
| 62-66 | Sanitation Target 2, 5 levels | % | `sanitation_targets.target2_sserv1..5` |

## 5. Technology mix + unit costs — **NEEDS UI WORK**
The contract carries a **technology mix (shares)** and **with-/without-treatment cost pairs**
that the current UI does not fully collect (it simplified to per-service-level + a few non-piped costs).
### Water (67-78)
| # | Parameter | Unit |
|---|---|---|
| 67-70 | Tech mix %: piped network / protected well / water tanker / borehole+handpump | % |
| 71-74 | Cost per HH **with** HH treatment: piped, well, tanker, borehole | LCU/HH |
| 75-78 | Cost per HH **without** HH treatment: piped, well, tanker, borehole | LCU/HH |
### Sanitation (79-95)
| # | Parameter | Unit |
|---|---|---|
| 79-84 | Tech mix %: piped / septic / pit / VIP / pit+slab / composting | % |
| 85-90 | Cost **with** treatment: network+connection, septic, pit, VIP, pit+slab, composting | LCU |
| 91-95 | Cost **without** treatment: network+connection, septic, pit, VIP, pit+slab | LCU |

## 6. WSS budget (96-98)
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 96 | Capex cost as % of total budget | % | `bau.capex_pct_budget` |
| 97 | Water supply budget as % of GDP | % | `macro.ws_budget_pct_gdp` |
| 98 | Sanitation budget as % of GDP | % | `macro.san_budget_pct_gdp` |

> Note: the contract splits budget by sector (97, 98); the old schema's single `wash_budget_pct_gdp`
> must be replaced by these two.

## 7. Planned investments — **five 5-year periods × 2 sectors** (99-108)
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 99-103 | Planned water supply investment: 2026-30, 31-35, 36-40, 41-45, 46-50 | LCU mn | `bau.ws_planned_*` |
| 104-108 | Planned sanitation investment: same 5 periods | LCU mn | `bau.san_planned_*` |

## 8. Technical (109-112)
| # | Parameter | Unit | Schema |
|---|---|---|---|
| 109 | % water sold to non-HH | % | `technical.ws_non_hh_pct` |
| 110 | Useful life of assets | years | `technical.ws_asset_life` (drives depreciation) |
| 111 | Water requirement (WHO) | L/cap/day | `technical.ws_water_req_who_lpcd` |
| 112 | % sanitation services sold to non-HH | % | `technical.san_non_hh_pct` |

## 9. Water interventions
| # | Parameter | Unit | Schema (`water_interventions.`) |
|---|---|---|---|
| 113-114 | CE start / target year | yr | `ce_start_year` / `ce_target_year` |
| 115-116 | CE current / target collection ratio | % | `ce_current_ratio` / `ce_target_ratio` |
| 117 | Total water supply volume sold | MLD | `ce_water_sold_mld` |
| 118 | Current avg water tariff | LCU/m³ | `ce_current_tariff` |
| 119-120 | NRW start / target year | yr | `nrw_start_year` / `nrw_target_year` |
| 121-122 | NRW current / target % | % | `nrw_current_pct` / `nrw_target_pct` |
| 123 | Water treatment cost as % of total capex | % | `nrw_treatment_cost_pct_capex` **(add)** |
| 124 | **Physical** losses as % of total NRW | % | `nrw_physical_loss_pct` (commercial = 1 − physical) |
| 125 | Lag CAPEX→improvement | years | `nrw_lag_years` |
| 126 | Capex unit cost per unit NRW reduced | USD(2023)/m³/day | `nrw_capex_unit_cost_usd` |
| 127-128 | Capex-efficiency start / gains | yr / % | `capeff_start_year` / `capeff_gains_pct` |
| 129-130 | Tariff start / target year | yr | `tariff_start_year` / `tariff_target_year` |
| 131 | Monthly income per capita, bottom 20% | LCU/person/mo | `tariff_monthly_income_bottom20` |
| 132 | Max % income on water | % | `tariff_max_pct_income_water` |
| 133-134 | Operating revenue / expenditure | LCU | `tariff_op_revenue` / `tariff_op_expenditure` |
| 135 | O&M cost-recovery target ratio | % | `tariff_om_recovery_target` |
| 136-137 | Borrow start / end year | yr | `loan_start_year` / `loan_end_year` |
| 138 | DSCR surplus | x | `loan_dscr` |
| 139-141 | Grace / tenor / interest rate | yr,yr,% | `loan_grace_years` / `loan_tenor` / `loan_interest_rate` |
| 142 | Years of investment | yr | `loan_investment_years` |

## 10. Sanitation interventions
| # | Parameter | Unit | Schema (`sanitation_interventions.`) |
|---|---|---|---|
| 143-144 | CE start / target year | yr | `ce_start_year` / `ce_target_year` |
| 145 | % wastewater collected | % | `ce_wastewater_collected_pct` |
| 146 | Sewer tariff as % of water tariff | % | `ce_sewer_tariff_pct_water` |
| 147-148 | Capex-efficiency start / gains | yr / % | `capeff_start_year` / `capeff_gains_pct` |
| 149-150 | Tariff start / target year | yr | `tariff_start_year` / `tariff_target_year` |
| 151 | Max % income on sanitation | % | `tariff_max_pct_income_san` |
| 152-153 | Borrow start / end year | yr | `loan_start_year` / `loan_end_year` |
| 154 | Avg cost per wastewater billed | LCU/m³ | `loan_avg_cost_per_ww_billed` |
| 155 | DSCR surplus | x | `loan_dscr` |
| 156-158 | Grace / tenor / interest rate | yr,yr,% | `loan_grace_years` / `loan_tenor` / `loan_interest_rate` |
| 159 | Years of investment | yr | `loan_investment_years` |
| 160 | Loan reduction cap | LCU mn | `loan_cap` |

## 11. Microfinance (sanitation) (161-168)
| # | Parameter | Unit | Schema (`sanitation_interventions.`) |
|---|---|---|---|
| 161-162 | MF start / end year | yr | `mf_start_year` / `mf_end_year` |
| 163 | Cost of collection & emptying | LCU | `mf_collection_cost` |
| 164 | Frequency of emptying | years | `mf_emptying_frequency` |
| 165 | % HHs with sewer/on-site but no treatment | % | `mf_pct_no_treatment` **(add)** |
| 166 | Max % income on sanitation | % | `mf_max_pct_income` |
| 167 | Low percentile (min income to afford MF) | % | `mf_low_percentile` |
| 168 | High percentile benefiting from MF | % | `mf_high_percentile` |

---

## Reconciliation actions vs current state

### Rename in schema (engine/schema → contract)
- `macro.inflation_nepal` → `macro.inflation_local`
- `macro.wash_budget_pct_gdp` (single) → `macro.ws_budget_pct_gdp` + `macro.san_budget_pct_gdp`
- `water_interventions.tariff_kukl_op_revenue/expenditure` → `tariff_op_revenue/expenditure`
- `loan_avg_cost_per_water` → keep; UI's `loan_avg_cost` must map to it; `loan_investment_year` → `loan_investment_years`
- `technical.ws_non_hh_pct_of_hh` → `ws_non_hh_pct` (and sanitation equivalent)

### Add to schema + UI (in contract, missing in UI)
- Water tech mix (4 shares) + with/without-treatment cost pairs (8) — items 67-78
- Sanitation tech mix (6 shares) + with/without-treatment costs (11) — items 79-95
- `bau.capex_pct_budget` (96)
- Five-period planned investments for water & sanitation (99-108)
- NRW `nrw_treatment_cost_pct_capex` (123); use **physical** loss % (124)
- Microfinance `mf_pct_no_treatment` (165), `mf_low_percentile` (167), `mf_high_percentile` (168)
- `as_is_forecast_start` / `as_is_forecast_length` — derive from period dates or expose

### Drop / mark non-canonical (in UI/schema, not in contract)
- `bau.ws_budget_ts` / `san_budget_ts` / `ws_expend_ts` / `san_expend_ts` (year-by-year budget mode)
- `macro.budget_input_mode` (the "direct" budget-entry toggle)
- Budget-execution intervention: `*_interventions.budget_exec_*` and the `*_budget_execution_enabled` toggles
- `technical.san_planned_wwt_mld` / `san_planned_fst_mld` (capacities are derived in the model)
- `water_costs.*` per-service-level scalars (superseded by the tech-mix cost structure above)

### Toggle name reconciliation
UI splits collection vs NRW (`ws_collection_enabled` + `ws_nrw_enabled`); contract/engine treat NRW as part
of `ws_collection_nrw_enabled`. Decide: keep them split in UI and OR them into one engine flag, or merge.
Remove the `*_budget_execution_enabled` toggles (non-canonical).
