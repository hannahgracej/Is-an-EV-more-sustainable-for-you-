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

  // --- LONG-TERM COST COMPARISON ---
  const gasPrice = inputs.gasPrice || FUEL_PRICE_PER_GALLON[curFuel] || 3.50;
  const elecPrice = inputs.elecPrice || ELECTRICITY_PRICE[gridMix] || 0.16;
  const evStickerPrice = inputs.evPrice || ev.msrp || 40000;

  // Tax incentives and trade-in
  const tradeInValue = inputs.tradeIn || 0;
  const federalCredit = inputs.federalCredit != null ? inputs.federalCredit : FEDERAL_EV_CREDIT;
  const stateCredit = inputs.stateCredit || 0;
  const totalIncentives = federalCredit + stateCredit;
  const evEffectivePrice = Math.max(0, evStickerPrice - tradeInValue - totalIncentives);

  // Keep: annual fuel cost
  const keepFuelCostPerYear = gallonsPerYear * gasPrice;
  const keepMaintenanceCostPerYear = MAINTENANCE_COST.ice;
  const keepInsuranceCostPerYear = INSURANCE_COST.ice;
  const keepAnnualCost = keepFuelCostPerYear + keepMaintenanceCostPerYear + keepInsuranceCostPerYear;

  // Switch: upfront + annual running cost
  const evElecCostPerYear = evMilesPerYear * kwhPerMileFromGrid * elecPrice;
  const evMaintenanceCostPerYear = MAINTENANCE_COST.ev;
  const evInsuranceCostPerYear = INSURANCE_COST.ev;
  const evAnnualRunning = evElecCostPerYear + evMaintenanceCostPerYear + evInsuranceCostPerYear;

  const keepTotalCost = keepAnnualCost * comparisonYears;
  const switchTotalCost = evEffectivePrice + evAnnualRunning * comparisonYears;

  const keepCostCumulative = [];
  const switchCostCumulative = [];
  for (let y = 1; y <= comparisonYears; y++) {
    keepCostCumulative.push(+(keepAnnualCost * y).toFixed(0));
    switchCostCumulative.push(+(evEffectivePrice + evAnnualRunning * y).toFixed(0));
  }

  // Cost breakeven: year when cumulative EV cost < cumulative keep cost
  let costBreakevenYear = null;
  const annualCostDiff = keepAnnualCost - evAnnualRunning;
  if (annualCostDiff > 0) {
    costBreakevenYear = evEffectivePrice / annualCostDiff;
    costBreakevenYear = Math.round(costBreakevenYear * 10) / 10;
  }

  const costSavings = keepTotalCost - switchTotalCost;

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

    cost: {
      keep: {
        fuelPerYear: +keepFuelCostPerYear.toFixed(0),
        maintenancePerYear: keepMaintenanceCostPerYear,
        insurancePerYear: keepInsuranceCostPerYear,
        annualTotal: +keepAnnualCost.toFixed(0),
        total: +keepTotalCost.toFixed(0),
        cumulative: keepCostCumulative,
      },
      ev: {
        stickerPrice: evStickerPrice,
        tradeInValue: tradeInValue,
        federalCredit: federalCredit,
        stateCredit: stateCredit,
        totalIncentives: totalIncentives,
        effectivePrice: +evEffectivePrice.toFixed(0),
        electricityPerYear: +evElecCostPerYear.toFixed(0),
        maintenancePerYear: evMaintenanceCostPerYear,
        insurancePerYear: evInsuranceCostPerYear,
        annualRunning: +evAnnualRunning.toFixed(0),
        total: +switchTotalCost.toFixed(0),
        cumulative: switchCostCumulative,
      },
      savings: +costSavings.toFixed(0),
      evCheaper: costSavings > 0,
      breakevenYear: costBreakevenYear,
      gasPrice,
      elecPrice,
    },
  };
}
