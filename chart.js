/*
  Lightweight canvas charting — no external dependencies.
  Draws the cumulative emissions line chart and breakdown doughnut charts.
*/

const COLORS = {
  keep: "#ea580c",
  keepLight: "rgba(234,88,12,0.12)",
  ev: "#0d9488",
  evLight: "rgba(13,148,136,0.12)",
  fuel: "#f97316",
  maint: "#64748b",
  mfg: "#8b5cf6",
  driving: "#06b6d4",
  grid: "#e2e8f0",
  text: "#1a2332",
  muted: "#94a3b8",
};

function drawLineChart(canvasId, result) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width;
  const H = Math.min(400, W * 0.5);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 30, right: 30, bottom: 50, left: 65 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const years = result.comparisonYears;
  const keepData = result.keep.cumulative;
  const evData = result.ev.cumulative;
  const maxVal = Math.max(...keepData, ...evData) * 1.1;

  const xStep = cw / years;
  const yScale = ch / maxVal;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + ch - (ch / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();

    ctx.fillStyle = COLORS.muted;
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(((maxVal / gridLines) * i).toFixed(1), pad.left - 10, y + 4);
  }

  // Y axis label
  ctx.save();
  ctx.translate(14, pad.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Tonnes CO\u2082", 0, 0);
  ctx.restore();

  // X axis labels
  ctx.textAlign = "center";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = COLORS.muted;
  for (let y = 0; y <= years; y++) {
    const x = pad.left + xStep * y;
    if (y % Math.ceil(years / 10) === 0 || y === years) {
      ctx.fillText("Yr " + y, x, H - pad.bottom + 25);
    }
  }

  function plotLine(data, color, fillColor) {
    // Fill
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(pad.left + xStep * (i + 1), pad.top + ch - data[i] * yScale);
    }
    ctx.lineTo(pad.left + xStep * data.length, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(pad.left + xStep * (i + 1), pad.top + ch - data[i] * yScale);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    // End dot
    const lastIdx = data.length - 1;
    ctx.beginPath();
    ctx.arc(pad.left + xStep * (lastIdx + 1), pad.top + ch - data[lastIdx] * yScale, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  plotLine(keepData, COLORS.keep, COLORS.keepLight);
  plotLine(evData, COLORS.ev, COLORS.evLight);

  // Breakeven marker
  if (result.breakevenYear && result.breakevenYear <= years) {
    const bx = pad.left + xStep * result.breakevenYear;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, pad.top);
    ctx.lineTo(bx, pad.top + ch);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Breakeven ~" + result.breakevenYear + " yr", bx, pad.top - 8);
  }

  // Legend
  const legendY = H - 12;
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "left";

  ctx.fillStyle = COLORS.keep;
  ctx.fillRect(pad.left, legendY - 10, 14, 14);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Keep Current Car", pad.left + 20, legendY + 2);

  ctx.fillStyle = COLORS.ev;
  ctx.fillRect(pad.left + 170, legendY - 10, 14, 14);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Switch to EV", pad.left + 190, legendY + 2);
}

function drawCostChart(canvasId, result) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width;
  const H = Math.min(400, W * 0.5);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 30, right: 30, bottom: 50, left: 75 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const years = result.comparisonYears;
  const keepData = result.cost.keep.cumulative;
  const evData = result.cost.ev.cumulative;
  const maxVal = Math.max(...keepData, ...evData) * 1.1;

  const xStep = cw / years;
  const yScale = ch / maxVal;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + ch - (ch / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();

    ctx.fillStyle = COLORS.muted;
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "right";
    const val = (maxVal / gridLines) * i;
    ctx.fillText("$" + Math.round(val).toLocaleString(), pad.left - 10, y + 4);
  }

  // Y axis label
  ctx.save();
  ctx.translate(14, pad.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Cumulative Cost ($)", 0, 0);
  ctx.restore();

  // X axis labels
  ctx.textAlign = "center";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = COLORS.muted;
  for (let y = 0; y <= years; y++) {
    const x = pad.left + xStep * y;
    if (y % Math.ceil(years / 10) === 0 || y === years) {
      ctx.fillText("Yr " + y, x, H - pad.bottom + 25);
    }
  }

  function plotLine(data, color, fillColor) {
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(pad.left + xStep * (i + 1), pad.top + ch - data[i] * yScale);
    }
    ctx.lineTo(pad.left + xStep * data.length, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(pad.left + xStep * (i + 1), pad.top + ch - data[i] * yScale);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    const lastIdx = data.length - 1;
    ctx.beginPath();
    ctx.arc(pad.left + xStep * (lastIdx + 1), pad.top + ch - data[lastIdx] * yScale, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  plotLine(keepData, COLORS.keep, COLORS.keepLight);
  plotLine(evData, COLORS.ev, COLORS.evLight);

  // Breakeven marker
  if (result.cost.breakevenYear && result.cost.breakevenYear <= years) {
    const bx = pad.left + xStep * result.cost.breakevenYear;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, pad.top);
    ctx.lineTo(bx, pad.top + ch);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Payback ~" + result.cost.breakevenYear + " yr", bx, pad.top - 8);
  }

  // Legend
  const legendY = H - 12;
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "left";

  ctx.fillStyle = COLORS.keep;
  ctx.fillRect(pad.left, legendY - 10, 14, 14);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Keep Current Car", pad.left + 20, legendY + 2);

  ctx.fillStyle = COLORS.ev;
  ctx.fillRect(pad.left + 170, legendY - 10, 14, 14);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("Switch to EV", pad.left + 190, legendY + 2);
}

function drawDoughnut(canvasId, segments, total) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width, 350);
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2 - 15;
  const radius = size * 0.34;
  const thickness = size * 0.12;

  ctx.clearRect(0, 0, size, size);

  let startAngle = -Math.PI / 2;
  segments.forEach(seg => {
    const sliceAngle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, radius - thickness, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(total.toFixed(1), cx, cy + 2);
  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("tonnes CO\u2082", cx, cy + 20);

  // Legend below
  let ly = cy + radius + 30;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "left";
  segments.forEach(seg => {
    ctx.fillStyle = seg.color;
    ctx.fillRect(cx - 80, ly - 9, 12, 12);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(seg.label + ": " + seg.value.toFixed(1) + "t", cx - 62, ly + 1);
    ly += 20;
  });
}
