/*
  Application logic — form handling, validation, and rendering results.
*/

(function () {
  // Populate year dropdown (2000–2026)
  const yearSelect = document.getElementById("cur-year");
  const frag = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select\u2026";
  frag.appendChild(placeholder);
  for (let y = 2026; y >= 2000; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    frag.appendChild(opt);
  }
  yearSelect.appendChild(frag);

  // Populate EV model dropdown
  const evSelect = document.getElementById("ev-model");
  EV_MODELS.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = m.name;
    evSelect.appendChild(opt);
  });

  // Auto-fill EV specs when model changes
  evSelect.addEventListener("change", function () {
    const ev = EV_MODELS.find(m => m.name === this.value);
    document.getElementById("ev-range").value = ev ? ev.range : "";
    document.getElementById("ev-battery").value = ev ? ev.battery : "";
  });

  // Sync EV miles with current miles
  document.getElementById("cur-miles").addEventListener("input", function () {
    document.getElementById("ev-miles").value = this.value;
  });
})();

function goToStep(n) {
  if (n === 2 && !validateStep1()) return;
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active-step"));
  const targets = { 1: "step-current", 2: "step-ev", 3: "results" };
  const el = document.getElementById(targets[n]);
  if (el) {
    el.classList.add("active-step");
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function validateStep1() {
  const fuel = document.getElementById("cur-fuel").value;
  const year = document.getElementById("cur-year").value;
  const size = document.getElementById("cur-size").value;
  const miles = document.getElementById("cur-miles").value;
  if (!fuel || !year || !size || !miles) {
    alert("Please fill in all required fields for your current car.");
    return false;
  }
  return true;
}

function validateStep2() {
  const model = document.getElementById("ev-model").value;
  const grid = document.getElementById("grid-mix").value;
  const miles = document.getElementById("ev-miles").value;
  const years = document.getElementById("ev-years").value;
  if (!model || !grid || !miles || !years) {
    alert("Please fill in all required fields for the EV.");
    return false;
  }
  return true;
}

function gatherInputs() {
  return {
    curFuel: document.getElementById("cur-fuel").value,
    curYear: parseInt(document.getElementById("cur-year").value),
    curSize: document.getElementById("cur-size").value,
    curMPG: parseFloat(document.getElementById("cur-mpg").value) || 0,
    curMilesPerYear: parseInt(document.getElementById("cur-miles").value),
    curAgeOwned: parseInt(document.getElementById("cur-age").value) || 0,
    evModel: document.getElementById("ev-model").value,
    evMilesPerYear: parseInt(document.getElementById("ev-miles").value),
    evYears: parseInt(document.getElementById("ev-years").value),
    gridMix: document.getElementById("grid-mix").value,
  };
}

function runAnalysis() {
  if (!validateStep2()) return;

  const inputs = gatherInputs();
  let result;
  try {
    result = runComparison(inputs);
  } catch (e) {
    alert("Error: " + e.message);
    return;
  }

  renderResults(result, inputs);
  goToStep(3);
}

function renderResults(r, inputs) {
  // Totals
  document.getElementById("keep-total").textContent = r.keep.total.toFixed(1);
  document.getElementById("switch-total").textContent = r.ev.total.toFixed(1);

  // Breakdowns
  const keepUl = document.getElementById("keep-breakdown");
  keepUl.innerHTML = `
    <li>Fuel combustion + upstream <span>${r.keep.fuel.toFixed(1)}t</span></li>
    <li>Maintenance & parts <span>${r.keep.maintenance.toFixed(1)}t</span></li>
    <li>Annual fuel emissions <span>${r.keep.annualFuel.toFixed(2)}t/yr</span></li>
  `;

  const switchUl = document.getElementById("switch-breakdown");
  switchUl.innerHTML = `
    <li>EV manufacturing <span>${r.ev.manufacturing.toFixed(1)}t</span></li>
    <li>Electricity (driving) <span>${r.ev.driving.toFixed(1)}t</span></li>
    <li>Maintenance & parts <span>${r.ev.maintenance.toFixed(1)}t</span></li>
    <li>Annual driving emissions <span>${r.ev.annualDriving.toFixed(2)}t/yr</span></li>
  `;

  // Summary
  const summaryEl = document.getElementById("results-summary");
  summaryEl.textContent = `Over ${r.comparisonYears} years, comparing your ${inputs.curYear} ${inputs.curSize} (${inputs.curFuel}, ~${r.mpgUsed} MPG) vs a new ${inputs.evModel}.`;

  // Verdict
  const verdict = document.getElementById("verdict-box");
  if (r.evIsBetter) {
    const pct = ((r.savings / r.keep.total) * 100).toFixed(0);
    verdict.className = "verdict better";
    verdict.innerHTML = `<strong>Switching to the EV saves ~${r.savings.toFixed(1)} tonnes of CO\u2082</strong> over ${r.comparisonYears} years — that's <strong>${pct}% less</strong> carbon than keeping your current car.` +
      (r.breakevenYear ? ` The EV's manufacturing emissions are offset after <strong>~${r.breakevenYear} years</strong> of driving.` : "");
  } else if (r.savings < 0) {
    verdict.className = "verdict worse";
    verdict.innerHTML = `<strong>Keeping your current car produces ${Math.abs(r.savings).toFixed(1)} fewer tonnes of CO\u2082</strong> over ${r.comparisonYears} years. The EV's manufacturing footprint isn't offset within this timeframe given your driving patterns and grid mix. Consider a longer ownership period or a cleaner electricity source.`;
  } else {
    verdict.className = "verdict neutral";
    verdict.innerHTML = `<strong>The two options are roughly equivalent</strong> in carbon emissions over ${r.comparisonYears} years. A cleaner electricity grid or more driving would tip the balance toward the EV.`;
  }

  // Charts
  drawLineChart("emissions-chart", r);

  drawDoughnut("breakdown-keep", [
    { label: "Fuel", value: r.keep.fuel, color: COLORS.fuel },
    { label: "Maintenance", value: r.keep.maintenance, color: COLORS.maint },
  ], r.keep.total);

  drawDoughnut("breakdown-switch", [
    { label: "Manufacturing", value: r.ev.manufacturing, color: COLORS.mfg },
    { label: "Electricity", value: r.ev.driving, color: COLORS.driving },
    { label: "Maintenance", value: r.ev.maintenance, color: COLORS.maint },
  ], r.ev.total);
}

// Redraw charts on window resize
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const resultsVisible = document.getElementById("results").classList.contains("active-step");
    if (resultsVisible) {
      const inputs = gatherInputs();
      try {
        const result = runComparison(inputs);
        drawLineChart("emissions-chart", result);
        drawDoughnut("breakdown-keep", [
          { label: "Fuel", value: result.keep.fuel, color: COLORS.fuel },
          { label: "Maintenance", value: result.keep.maintenance, color: COLORS.maint },
        ], result.keep.total);
        drawDoughnut("breakdown-switch", [
          { label: "Manufacturing", value: result.ev.manufacturing, color: COLORS.mfg },
          { label: "Electricity", value: result.ev.driving, color: COLORS.driving },
          { label: "Maintenance", value: result.ev.maintenance, color: COLORS.maint },
        ], result.ev.total);
      } catch (_) {}
    }
  }, 200);
});
