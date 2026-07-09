"""
Canonical input schema for the WSS Strategic Scenarios tool.

This is the single source of truth for model inputs. It mirrors the hardcoded
"Input" (grey) cells of the Excel `I|General` sheet — 168 parameters — documented
in `INPUT_CONTRACT.md`. Comments cite the contract item number (#N) and the Excel
cell where useful.

Structure notes:
  * The model is PER AREA. One `ModelInputs` describes one area (Urban, Rural, or
    National). The orchestrator runs each entered area and aggregates Urban+Rural
    into National.
  * Macro / population fields are ANNUAL TIME SERIES (one value per year over the
    historical range, forecast filled by the engine).
  * Service levels are TWO POINTS only: the start year and the baseline year.
  * Default values are illustrative (Nepal Kathmandu Valley) and exist only so the
    schema is runnable for testing — the binding part is the field list, units and
    structure, not the numbers.
"""

from pydantic import BaseModel
from typing import List, Optional


# ──────────────────────────────────────────────────────────────────────────
# Constants & labels  (contract #1-#18) — universal, not per-scenario
# ──────────────────────────────────────────────────────────────────────────
class Constants(BaseModel):
    days_in_month: int = 30        # #1
    days_in_year: int = 365        # #2
    thousand: int = 1_000          # #3
    million: int = 1_000_000       # #4
    cubic_meter_liters: int = 1_000  # #5
    months_in_year: int = 12       # used to annualise monthly income (tariff calcs)


class CountryConfig(BaseModel):
    country: str = "Nepal"                 # #6
    area: str = "Kathmandu Valley"
    area_type: str = "Urban"               # #7  — "Urban" | "Rural" | "National"
    currency: str = "NPR"                  # #8
    currency_usd: str = "USD"
    # Water service-level labels — JMP ladder (#9-#13)
    ws_serv1_name: str = "Safely managed"
    ws_serv2_name: str = "Basic"
    ws_serv3_name: str = "Limited"
    ws_serv4_name: str = "Unimproved"
    ws_serv5_name: str = "No Service"
    # Sanitation service-level labels (#14-#18)
    san_serv1_name: str = "Safely managed"
    san_serv2_name: str = "Basic"
    san_serv3_name: str = "Limited"
    san_serv4_name: str = "Unimproved"
    san_serv5_name: str = "No Service"


# ──────────────────────────────────────────────────────────────────────────
# Time scales
# ──────────────────────────────────────────────────────────────────────────
class PeriodInputs(BaseModel):
    model_start_year: int = 2011      # first historical (service-level "start") year
    baseline_year: int = 2025         # most recent complete-data year
    forecast_end_year: int = 2040     # last projection year (model horizon)
    target1_year: int = 2030          # interim target (Target 1)
    target2_year: int = 2040          # final target (Target 2)
    # As-is forecast window (Excel inputs G18/G19): the years that simply continue current
    # trends/budgets before the performance-improvement (target) path branches off.
    #   end-of-as-is year = as_is_forecast_start + as_is_forecast_length - 1   (2026 + 2 - 1 = 2027)
    #   performance-improvement start = end-of-as-is + 1                        (2028)
    as_is_forecast_start: int = 2026
    as_is_forecast_length: int = 2
    real_price_year: int = 2025       # anchor year for real-price deflation (Excel G51)


# ──────────────────────────────────────────────────────────────────────────
# Macroeconomics  (contract #19-#23) — annual time series
# ──────────────────────────────────────────────────────────────────────────
class MacroInputs(BaseModel):
    gdp_growth: List[float] = []          # #19 annual real GDP growth, % (historical)
    gdp_growth_forecast: float = 0.05     # fixed real GDP growth applied to forecast years (after the USD/GDP data ends)
    gdp_nominal_usd: List[float] = []     # #20 GDP hard values (historical + any forecast years with data); the
                                          #     tail is projected at gdp_growth_forecast (real terms)
    inflation_local_ongoing: float = 0.05    # fixed local inflation for forecast years past the hard series
    inflation_us_ongoing: float = 0.022      # fixed US inflation for forecast years past the hard series
    inflation_local: List[float] = []   # #21 annual local inflation, %
    inflation_us: List[float] = []      # #22 annual US inflation, %
    exchange_rate: List[float] = []     # #23 local currency per 1 USD


# ──────────────────────────────────────────────────────────────────────────
# Population  (contract #24-#25) — annual time series
# ──────────────────────────────────────────────────────────────────────────
class PopulationInputs(BaseModel):
    # Households (#25) are the PRIMARY series for the 4a-4d math (sheet I!92): historical actuals,
    # forecast at the MEAN historical year-on-year HH growth (sheet G93). Population (#24, I!89) is a
    # parallel series forecast at the mean historical population growth (G90). Household SIZE (I!95)
    # is DERIVED for display only = population / households — it is NOT an input and not used in 4a-4d.
    pop_ts: List[float] = []   # #24 total population (millions of people), historical
    hh_ts: List[float] = []    # #25 total households (millions), historical


# ──────────────────────────────────────────────────────────────────────────
# Service levels  (contract #26-#45) — 5 levels, START year + BASELINE year
# ──────────────────────────────────────────────────────────────────────────
class WaterServiceLevelInputs(BaseModel):
    # Start year, % of HHs at each level (#26-#30) — full workbook precision (I!102-106)
    pct_serv1_start: float = 0.56560166762623     # Safely managed
    pct_serv2_start: float = 0.3403983323737703   # Basic
    pct_serv3_start: float = 0.0260               # Limited
    pct_serv4_start: float = 0.0580               # Unimproved
    pct_serv5_start: float = 0.0100               # No Service
    # Baseline year, % of HHs at each level (#31-#35) — full workbook precision (I!116-120)
    pct_serv1_baseline: float = 0.513729462650536
    pct_serv2_baseline: float = 0.386270537349464
    pct_serv3_baseline: float = 0.0320
    pct_serv4_baseline: float = 0.0590
    pct_serv5_baseline: float = 0.0090


class SanitationServiceLevelInputs(BaseModel):
    # Start year (#36-#40) — I!152-156
    pct_sserv1_start: float = 0.0288   # Safely managed
    pct_sserv2_start: float = 0.9700   # Basic
    pct_sserv3_start: float = 0.0001   # Limited
    pct_sserv4_start: float = 0.0010   # Unimproved
    pct_sserv5_start: float = 0.0001   # No Service
    # Baseline year (#41-#45) — full workbook precision (I!166-170)
    pct_sserv1_baseline: float = 0.07774752344348565
    pct_sserv2_baseline: float = 0.909252476556514
    pct_sserv3_baseline: float = 0.0080
    pct_sserv4_baseline: float = 0.0030
    pct_sserv5_baseline: float = 0.0020


# ──────────────────────────────────────────────────────────────────────────
# Targets  (contract #46-#66)
# ──────────────────────────────────────────────────────────────────────────
class WaterTargetInputs(BaseModel):
    # Target 1 (2030) — % of HHs at each level (#46-#50)
    target1_serv1: float = 0.66
    target1_serv2: float = 0.34
    target1_serv3: float = 0.0
    target1_serv4: float = 0.0
    target1_serv5: float = 0.0
    # Target 2 (2040) (#51-#55)
    target2_serv1: float = 1.0
    target2_serv2: float = 0.0
    target2_serv3: float = 0.0
    target2_serv4: float = 0.0
    target2_serv5: float = 0.0


class SanitationTargetInputs(BaseModel):
    onsite_collection_treatment_pct: float = 0.12   # #56 % on-site sanitation
    # Target 1 (2030) (#57-#61)
    target1_sserv1: float = 0.66
    target1_sserv2: float = 0.34
    target1_sserv3: float = 0.0
    target1_sserv4: float = 0.0
    target1_sserv5: float = 0.0
    # Target 2 (2040) (#62-#66)
    target2_sserv1: float = 1.0
    target2_sserv2: float = 0.0
    target2_sserv3: float = 0.0
    target2_sserv4: float = 0.0
    target2_sserv5: float = 0.0


# ──────────────────────────────────────────────────────────────────────────
# Technology mix + unit costs  (contract #67-#95)
# Costs are per HH, in local currency, at base-year prices.
# The Safely-managed and Basic rungs each have their OWN technology mix — different technologies
# and/or shares — so the two weighted costs are computed from independent lists. Each list is open
# (name editable, add/remove) and its shares must total 1. Weighted cost = Σ(share × cost).
# ──────────────────────────────────────────────────────────────────────────
class Tech(BaseModel):
    name: str = "Technology"
    share: float = 0.0    # share of HHs at this rung served by this technology (fraction)
    cost: float = 0.0     # capex per HH for this technology (base-year prices)


class WaterUnitCosts(BaseModel):
    # Component costs at full workbook precision (I!258-261 / I!266-269)
    sm_technologies: List[Tech] = [        # safely-managed mix -> weighted SM connection cost (=96,878)
        Tech(name="Piped network",       share=0.65, cost=105_388.31832439502),
        Tech(name="Protected well",      share=0.15, cost=60_000.0),
        Tech(name="Water tanker",        share=0.10, cost=96_878.0),
        Tech(name="Borehole + handpump", share=0.10, cost=96_877.9308914323),
    ]
    basic_technologies: List[Tech] = [     # basic mix -> weighted basic-rung cost (=86,875.593)
        Tech(name="Piped network",       share=0.65, cost=90_000.0),
        Tech(name="Protected well",      share=0.15, cost=60_000.0),
        Tech(name="Water tanker",        share=0.10, cost=96_878.0),
        Tech(name="Borehole + handpump", share=0.10, cost=96_877.9308914323),
    ]


class SanitationUnitCosts(BaseModel):
    # Component costs at full workbook precision (I!284-289 / I!295-299)
    sm_technologies: List[Tech] = [        # safely-managed mix -> weighted SM cost (=105,050.234)
        Tech(name="Piped / network", share=0.6570, cost=117_290.76671794064),
        Tech(name="Septic tank",     share=0.3360, cost=83_000.0),
        Tech(name="Pit latrine",     share=0.0060, cost=14_600.0),
        Tech(name="VIP latrine",     share=0.0,    cost=16_500.0),
        Tech(name="Pit + slab",      share=0.0010, cost=14_600.0),
        Tech(name="Composting",      share=0.0,    cost=22_000.0),
    ]
    basic_technologies: List[Tech] = [     # basic mix -> weighted basic-rung cost (=105,050.234)
        Tech(name="Piped / network", share=0.6570, cost=117_290.76671794064),
        Tech(name="Septic tank",     share=0.3360, cost=83_000.0),
        Tech(name="Pit latrine",     share=0.0060, cost=14_600.0),
        Tech(name="VIP latrine",     share=0.0,    cost=16_500.0),
        Tech(name="Pit + slab",      share=0.0010, cost=14_600.0),
        Tech(name="Composting",      share=0.0,    cost=22_000.0),
    ]


# ──────────────────────────────────────────────────────────────────────────
# WSS budget  (contract #96-#98)
# ──────────────────────────────────────────────────────────────────────────
class WSSBudgetInputs(BaseModel):
    capex_pct_budget: float = 0.21          # #96 capex as % of total budget (shared fallback / legacy)
    # Per-sector capex share of that sector's budget. Water and sanitation carry DIFFERENT capex
    # fractions in the workbook (excel2 I|General Urban: water G321 = 0.21, sanitation G328 = 0.15).
    # If None, the sector falls back to capex_pct_budget (backward-compatible with old payloads).
    ws_capex_pct: Optional[float] = None    # water capex as % of water budget  (sheet G321)
    san_capex_pct: Optional[float] = None   # sanitation capex as % of sanitation budget (sheet G328)
    ws_budget_pct_gdp: float = 0.0016496186144332283   # #97 water supply budget as % of GDP (sheet G324)
    san_budget_pct_gdp: float = 0.0004  # #98 sanitation budget as % of GDP (final.xlsx sheet G331)
    # Budget execution rate (%GDP mode only): the share of the ALLOCATED capex budget that is
    # actually spent. actual capex = allocated (%GDP × real GDP × %capex) × execution_rate. A single
    # rate shared by both sectors. 1.0 = full execution (reproduces the pre-execution-rate results).
    execution_rate: float = 1.0
    # Budget source: 'pct_gdp' (full budget = real GDP × %GDP) or 'direct' (enter the actual
    # expenditure series directly, real terms). In 'direct' mode the *_budget_direct series is the
    # full sector budget per year; years past the hard values compound at *_budget_direct_ongoing.
    budget_input_mode: str = 'pct_gdp'
    ws_budget_direct: List[float] = []
    san_budget_direct: List[float] = []
    ws_budget_direct_ongoing: float = 0.05
    san_budget_direct_ongoing: float = 0.05


# ──────────────────────────────────────────────────────────────────────────
# Planned investments  (contract #99-#108)
# Five fixed 5-year periods: 2026-30, 2031-35, 2036-40, 2041-45, 2046-50.
# Amounts in local currency, millions.
# ──────────────────────────────────────────────────────────────────────────
class PlannedInvestmentInputs(BaseModel):
    first_period_start: int = 2026
    period_length_years: int = 5
    n_periods: int = 5
    # sheet I!326-330 exact values (Σ = 47,069.921); annual planned = Σ ÷ (target2 − baseline)
    ws_planned: List[float] = [16_223.765355365464, 14_005.46734156549, 9_306.350838959635,
                               4_817.250716358515, 2_717.0869163112056]           # #99-#103
    san_planned: List[float] = [17_000.0, 12_000.0, 11_000.0, 7_000.0, 5_000.0]   # #104-#108 (I!338-342)


# ──────────────────────────────────────────────────────────────────────────
# Technical  (contract #109-#112)
# ──────────────────────────────────────────────────────────────────────────
class TechnicalInputs(BaseModel):
    ws_non_hh_pct: float = 0.10           # #109 % water sold to non-HH
    ws_asset_life: int = 30               # #110 useful life of assets (years) — water depreciation
    ws_water_req_who_lpcd: float = 75.0   # #111 WHO water requirement, L/capita/day
    san_non_hh_pct: float = 0.10          # #112 % sanitation services sold to non-HH
    san_asset_life: int = 30              # sanitation depreciation (Excel I!G367, separate from water)


# ──────────────────────────────────────────────────────────────────────────
# Water supply interventions  (contract #113-#142)
# ──────────────────────────────────────────────────────────────────────────
class WaterInterventionInputs(BaseModel):
    # Increased collection efficiency (#113-#118)
    ce_start_year: int = 2028
    ce_target_year: int = 2031
    ce_current_ratio: float = 0.83
    ce_target_ratio: float = 0.98
    ce_water_sold_mld: float = 240.0
    ce_current_tariff: float = 32.0          # local currency per m3

    # NRW reduction (#119-#126)
    nrw_start_year: int = 2028
    nrw_target_year: int = 2034
    nrw_current_pct: float = 0.40
    nrw_target_pct: float = 0.15
    nrw_treatment_cost_pct_capex: float = 0.40   # #123 water treatment cost as % of total capex
    nrw_physical_loss_pct: float = 0.50          # #124 physical losses as % of total NRW
    nrw_lag_years: int = 1                       # #125
    nrw_capex_unit_cost_usd: float = 510.0       # #126 USD(2023) per m3/day of NRW reduced

    # Increased capital-expenditure efficiency (#127-#128)
    capeff_start_year: int = 2027
    capeff_gains_pct: float = 0.20

    # Tariff increase (#129-#135)
    tariff_start_year: int = 2028
    tariff_target_year: int = 2033
    tariff_monthly_income_bottom20: float = 10_904.0   # local currency / person / month
    tariff_max_pct_income_water: float = 0.05
    tariff_op_revenue: float = 1_169_262_000.0
    tariff_op_expenditure: float = 954_612_000.0
    tariff_om_recovery_target: float = 1.50

    # Borrow against future cashflow (#136-#142)
    loan_start_year: int = 2036
    loan_end_year: int = 2040
    loan_dscr: float = 1.2
    loan_grace_years: int = 4
    loan_tenor: int = 12
    loan_interest_rate: float = 0.067
    loan_investment_years: int = 4


# ──────────────────────────────────────────────────────────────────────────
# Sanitation interventions  (contract #143-#160)
# ──────────────────────────────────────────────────────────────────────────
class SanitationInterventionInputs(BaseModel):
    # Increased collection efficiency (#143-#146)
    ce_start_year: int = 2027
    ce_target_year: int = 2030
    ce_wastewater_collected_pct: float = 0.80    # #145
    ce_sewer_tariff_pct_water: float = 0.50      # #146 sewer tariff as % of water tariff

    # Increased capital-expenditure efficiency (#147-#148)
    capeff_start_year: int = 2027
    capeff_gains_pct: float = 0.20

    # Tariff increase (#149-#151)
    tariff_start_year: int = 2028
    tariff_target_year: int = 2033
    tariff_max_pct_income_san: float = 0.05

    # Borrow against future cashflow (#152-#160)
    loan_start_year: int = 2036
    loan_end_year: int = 2040
    loan_avg_cost_per_ww_billed: float = 0.0     # #154 local currency per m3
    loan_dscr: float = 1.2
    loan_grace_years: int = 4
    loan_tenor: int = 12
    loan_interest_rate: float = 0.067
    loan_investment_years: int = 3
    loan_cap: float = 12_500.0                   # #160 loan reduction cap, local currency mn


# ──────────────────────────────────────────────────────────────────────────
# Microfinance for on-site sanitation  (contract #161-#168)
# ──────────────────────────────────────────────────────────────────────────
class MicrofinanceInputs(BaseModel):
    start_year: int = 2028                  # #161
    end_year: int = 2040                    # #162
    collection_emptying_cost: float = 6_000.0   # #163 local currency
    emptying_frequency_years: float = 3.2       # #164
    pct_no_treatment: float = 0.6451            # #165 % HHs with sewer/on-site but no treatment
    max_pct_income: float = 0.05                # #166 max % income spent on sanitation
    low_percentile: float = 0.05                # #167 min-income percentile that can afford MF
    high_percentile: float = 0.20               # #168 top percentile benefiting from MF


# ──────────────────────────────────────────────────────────────────────────
# Run configuration (not part of the 168 — scenario switches for the tool)
# ──────────────────────────────────────────────────────────────────────────
class InterventionToggles(BaseModel):
    # Water supply
    ws_collection_efficiency_enabled: bool = True
    ws_nrw_enabled: bool = True
    ws_capital_efficiency_enabled: bool = True
    ws_tariff_enabled: bool = True
    ws_borrowing_enabled: bool = True
    # Sanitation
    san_collection_efficiency_enabled: bool = True
    san_capital_efficiency_enabled: bool = True
    san_tariff_enabled: bool = True
    san_borrowing_enabled: bool = True
    san_microfinance_enabled: bool = True


# ──────────────────────────────────────────────────────────────────────────
# Top-level model inputs (one area)
# ──────────────────────────────────────────────────────────────────────────
class ModelInputs(BaseModel):
    country_config: CountryConfig = CountryConfig()
    period: PeriodInputs = PeriodInputs()
    constants: Constants = Constants()
    macro: MacroInputs = MacroInputs()
    wss_budget: WSSBudgetInputs = WSSBudgetInputs()
    population: PopulationInputs = PopulationInputs()
    water_service: WaterServiceLevelInputs = WaterServiceLevelInputs()
    sanitation_service: SanitationServiceLevelInputs = SanitationServiceLevelInputs()
    water_targets: WaterTargetInputs = WaterTargetInputs()
    sanitation_targets: SanitationTargetInputs = SanitationTargetInputs()
    water_costs: WaterUnitCosts = WaterUnitCosts()
    sanitation_costs: SanitationUnitCosts = SanitationUnitCosts()
    planned_investments: PlannedInvestmentInputs = PlannedInvestmentInputs()
    technical: TechnicalInputs = TechnicalInputs()
    water_interventions: WaterInterventionInputs = WaterInterventionInputs()
    sanitation_interventions: SanitationInterventionInputs = SanitationInterventionInputs()
    microfinance: MicrofinanceInputs = MicrofinanceInputs()
    toggles: InterventionToggles = InterventionToggles()
