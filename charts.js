(function () {
  "use strict";

  const chartInstances = new Map();

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmtDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const getSeriesColor = (index) => [css("--accent"), css("--blue"), css("--green"), css("--orange"), css("--yellow")][index] || css("--text");

  const buildExpectedWeight = (entries, profile) => {
    if (!entries.length) return [];
    const start = entries[0].date;
    return entries.map((entry) => {
      const weeks = HWPStorage.daysBetween(start, entry.date) / 7;
      return Math.max(profile.targetWeight, profile.initialWeight - weeks * 0.75);
    });
  };

  const weeklyAdherence = (entries) => {
    const groups = new Map();
    entries.forEach((entry) => {
      const date = new Date(`${entry.date}T00:00:00`);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const list = groups.get(key) || [];
      list.push(entry.adherence || 0);
      groups.set(key, list);
    });
    return [...groups.entries()].map(([date, values]) => ({
      date,
      value: values.reduce((sum, value) => sum + value, 0) / values.length
    }));
  };

  const movingAverage = (entries, field, windowSize = 7) =>
    entries.map((entry, index) => {
      const slice = entries.slice(Math.max(0, index - windowSize + 1), index + 1);
      return HWPStorage.average(slice, field);
    });

  const bmiSeries = (entries, height) =>
    entries.map((entry) => (entry.weight ? entry.weight / (height * height) : 0));

  const datasets = (state, metrics) => {
    const entries = metrics.entries;
    const labels = entries.map((entry) => fmtDate(entry.date));
    const weekly = weeklyAdherence(entries);

    return {
      weightChart: {
        labels,
        series: [
          { label: "Peso real", values: entries.map((entry) => entry.weight), color: getSeriesColor(0) },
          { label: "Peso esperado", values: buildExpectedWeight(entries, state.profile), color: getSeriesColor(1), dashed: true }
        ],
        suffix: " kg"
      },
      waistChart: {
        labels,
        series: [{ label: "Cintura", values: entries.map((entry) => entry.waist), color: getSeriesColor(2) }],
        suffix: " cm"
      },
      adherenceChart: {
        labels: weekly.map((item) => fmtDate(item.date)),
        series: [{ label: "Aderência", values: weekly.map((item) => item.value), color: getSeriesColor(3) }],
        suffix: "%"
      },
      proteinChart: {
        labels,
        series: [
          { label: "Proteína", values: movingAverage(entries, "protein"), color: getSeriesColor(2) },
          { label: "Meta", values: entries.map(() => state.profile.dailyProtein), color: getSeriesColor(1), dashed: true }
        ],
        suffix: " g"
      },
      caloriesChart: {
        labels,
        series: [
          { label: "Calorias", values: movingAverage(entries, "calories"), color: getSeriesColor(4) },
          { label: "Meta", values: entries.map(() => state.profile.dailyCalories), color: getSeriesColor(0), dashed: true }
        ],
        suffix: " kcal"
      },
      bmiChart: {
        labels,
        series: [{ label: "IMC", values: bmiSeries(entries, state.profile.height), color: getSeriesColor(1) }],
        suffix: ""
      }
    };
  };

  const destroyChartJs = (id) => {
    const instance = chartInstances.get(id);
    if (instance?.destroy) instance.destroy();
    chartInstances.delete(id);
  };

  const renderWithChartJs = (canvas, config) => {
    if (!window.Chart) return false;
    destroyChartJs(canvas.id);
    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: config.labels,
        datasets: config.series.map((serie) => ({
          label: serie.label,
          data: serie.values,
          borderColor: serie.color,
          backgroundColor: `${serie.color}22`,
          borderDash: serie.dashed ? [6, 5] : [],
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.32,
          fill: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: css("--muted"), boxWidth: 12, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(1)}${config.suffix}`
            }
          }
        },
        scales: {
          x: { ticks: { color: css("--muted") }, grid: { color: "transparent" } },
          y: { ticks: { color: css("--muted") }, grid: { color: css("--line") } }
        }
      }
    });
    chartInstances.set(canvas.id, chart);
    return true;
  };

  const drawFallback = (canvas, config) => {
    destroyChartJs(canvas.id);
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(220, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const pad = { top: 20, right: 16, bottom: 34, left: 46 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const text = css("--text");
    const muted = css("--muted");
    const line = css("--line");

    ctx.clearRect(0, 0, width, height);
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = muted;

    const values = config.series.flatMap((serie) => serie.values).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length || !config.labels.length) {
      ctx.fillStyle = muted;
      ctx.textAlign = "center";
      ctx.fillText("Adicione check-ins para visualizar este gráfico.", width / 2, height / 2);
      return;
    }

    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const padding = (max - min) * 0.12;
    min -= padding;
    max += padding;

    const xFor = (index) => pad.left + (config.labels.length === 1 ? plotW / 2 : (index / (config.labels.length - 1)) * plotW);
    const yFor = (value) => pad.top + (1 - (value - min) / (max - min)) * plotH;

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (plotH / 4) * i;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      const label = max - ((max - min) / 4) * i;
      ctx.fillStyle = muted;
      ctx.textAlign = "right";
      ctx.fillText(label.toFixed(label > 100 ? 0 : 1), pad.left - 8, y + 4);
    }
    ctx.stroke();

    config.series.forEach((serie) => {
      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 3;
      ctx.setLineDash(serie.dashed ? [6, 5] : []);
      ctx.beginPath();
      let started = false;
      serie.values.forEach((value, index) => {
        if (!Number.isFinite(value) || value <= 0) return;
        const x = xFor(index);
        const y = yFor(value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      serie.values.forEach((value, index) => {
        if (!Number.isFinite(value) || value <= 0) return;
        ctx.fillStyle = serie.color;
        ctx.beginPath();
        ctx.arc(xFor(index), yFor(value), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    const firstLabel = config.labels[0];
    const lastLabel = config.labels[config.labels.length - 1];
    ctx.fillStyle = muted;
    ctx.textAlign = "left";
    ctx.fillText(firstLabel, pad.left, height - 10);
    ctx.textAlign = "right";
    ctx.fillText(lastLabel, width - pad.right, height - 10);

    let legendX = pad.left;
    config.series.forEach((serie) => {
      ctx.fillStyle = serie.color;
      ctx.fillRect(legendX, 6, 10, 10);
      ctx.fillStyle = text;
      ctx.textAlign = "left";
      ctx.fillText(serie.label, legendX + 14, 15);
      legendX += ctx.measureText(serie.label).width + 42;
    });
  };

  const renderCanvas = (id, config) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (!renderWithChartJs(canvas, config)) drawFallback(canvas, config);
  };

  const renderAll = (state, metrics) => {
    const all = datasets(state, metrics);
    Object.entries(all).forEach(([id, config]) => renderCanvas(id, config));
  };

  const getImages = () =>
    ["weightChart", "waistChart", "adherenceChart", "proteinChart", "caloriesChart", "bmiChart"]
      .map((id) => {
        const canvas = document.getElementById(id);
        return canvas ? { id, image: canvas.toDataURL("image/png") } : null;
      })
      .filter(Boolean);

  window.HWPCharts = {
    renderAll,
    getImages,
    datasets
  };
})();
