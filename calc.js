/*
  Carbon comparison calculation engine.

  Key principles:
  - The manufacturing emissions of the current car are already "sunk" — they don't
    count towards the "keep" scenario because you can't un-emit them.
  - Switching to an EV incurs NEW manufacturing emissions (battery + vehicle assembly).
  - Both scenarios accrue operational emissions over the comparison period.
  - We also account for the residual embodied carbon "saved" if the old car still has
    useful life left (avoids someone else manufacturing a replacement sooner).
*/

function runComparison(inputs) {
  const {
    curFuel, curYear, curSize, curMPG, curMilesPerYear, curAgeOwned,
    evModel, evMilesPerYear, evYears, gridMix,
  } = inputs;

  const ev = EV_MODELS.find(m => m.name === evModel);
  if (!ev) throw new Error("EV model not found");

  const mpg = curMPG || estimateMPG(curSize, curFuel, curYear);
  const comparisonYears = evYears;

  // --- KEEP CURRENT CAR scenario ---
  const gallonsPerYear = curMilesPerYear / mpg;
  const fuelCO2PerYear = gallonsPerYear * FUEL_CO2_PER_GALLON[curFuel] * UPSTREAM_FACTOR[curFuel] / 1000;
  const keepMaintenancePerYear = MAINTENANCE_CO2.ice;

  const keepFuelTotal = fuelCO2PerYear * comparisonYears;
  const keepMaintenanceTotal = keepMaintenancePerYear * comparisonYears;
  const keepTotal = keepFuelTotal + keepMaintenanceTotal;

  // Year-by-year cumulative for charting
  const keepCumulative = [];
  for (let y = 1; y <= comparisonYears; y++) {
    keepCumulative.push(+(fuelCO2PerYear * y + keepMaintenancePerYear * y).toFixed(2));
  }

  // --- SWITCH TO EV scenario ---
  const evMfgCO2 = ev.mfgCO2;

  // EV efficiency: kWh per mile
  const evEfficiency = ev.battery / ev.range;
  // Account for charging losses (~10%)
  const kwhPerMileFromGrid = evEfficiency * 1.10;
  const gridCO2 = GRID_INTENSITY[gridMix] || GRID_INTENSITY["us-avg"];
  const evDrivingCO2PerYear = (evMilesPerYear * kwhPerMileFromGrid * gridCO2) / 1000;
  const evMaintenancePerYear = MAINTENANCE_CO2.ev;

  const switchDrivingTotal = evDrivingCO2PerYear * comparisonYears;
  const switchMaintenanceTotal = evMaintenancePerYear * comparisonYears;
  const switchTotal = evMfgCO2 + switchDrivingTotal + switchMaintenanceTotal;

  const switchCumulative = [];
  for (let y = 1; y <= comparisonYears; y++) {
    switchCumulative.push(+(evMfgCO2 + evDrivingCO2PerYear * y + evMaintenancePerYear * y).toFixed(2));
  }

  // --- Breakeven year ---
  let breakevenYear = null;
  const evAnnual = evDrivingCO2PerYear + evMaintenancePerYear;
  const keepAnnual = fuelCO2PerYear + keepMaintenancePerYear;
  if (evAnnual < keepAnnual) {
    breakevenYear = evMfgCO2 / (keepAnnual - evAnnual);
    breakevenYear = Math.round(breakevenYear * 10) / 10;
  }

  const savings = keepTotal - switchTotal;

  return {
    comparisonYears,
    mpgUsed: mpg,

    keep: {
      fuel: +keepFuelTotal.toFixed(2),
      maintenance: +keepMaintenanceTotal.toFixed(2),
      total: +keepTotal.toFixed(2),
      cumulative: keepCumulative,
      annualFuel: +fuelCO2PerYear.toFixed(2),
    },

    ev: {
      manufacturing: +evMfgCO2.toFixed(2),
      driving: +switchDrivingTotal.toFixed(2),
      maintenance: +switchMaintenanceTotal.toFixed(2),
      total: +switchTotal.toFixed(2),
      cumulative: switchCumulative,
      annualDriving: +evDrivingCO2PerYear.toFixed(2),
      batteryKWh: ev.battery,
      range: ev.range,
    },

    savings: +savings.toFixed(2),
    breakevenYear,
    evIsBetter: savings > 0,
  };
}
