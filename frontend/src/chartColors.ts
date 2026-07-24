// ── Tool-wide chart colour convention — ONE meaning per colour ──────────────────────────────────
// Every graph in the tool (BAU chart, intervention-impact chart, results fan charts) must use these
// for the corresponding data series, so a colour always carries the same meaning to the reader.
export const C = {
  bau: '#2563eb',        // business-as-usual (BLUE)
  bauFill: '#bfdbfe',    // light-blue area fill for a BAU band
  target: '#16a34a',     // target — the level we're closing toward (GREEN)
  scenario: '#ea580c',   // with interventions / reforms (ORANGE)
  scenarioFill: '#fdba74', // light-orange fill for the intervention band/range
  total: '#6b7280',      // total households / coverage ceiling (GREY, dashed)
  gap: '#b91c1c',        // financing gap / shortfall (RED — a money dimension, not BAU/target/scenario)
};

// Per-intervention categorical palette for the intervention-impact chart's stacked bands.
// Deliberately EXCLUDES blue (BAU) and green (target) so those meanings stay reserved.
// Order matches the intervention lists in LiveInterventionChart.
export const INTV_PALETTE = {
  collection: '#0891b2', // cyan
  budgetExec: '#ca8a04', // gold  (was green — conflicted with target)
  capex: '#7c3aed',      // violet
  techmix: '#0d9488',    // teal
  nrw: '#be123c',        // rose  (was blue — conflicted with BAU)
  tariff: '#d97706',     // amber
  microfinance: '#db2777', // pink
  custom: '#9333ea',     // purple (default for custom interventions)
};
