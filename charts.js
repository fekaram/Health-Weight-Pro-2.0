(function () {
  "use strict";

  const charts = new Map();

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const dateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const fallbackLine = (canvas, labels, series) => {
    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, rect.width) * ratio;
    canvas.height = 250 * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = css("--line");
    context.fillStyle = css("--muted");
    context.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const y = 24 + i * 46;
      context.beginPath();
      context.moveTo(34, y);
      context.lineTo(rect.width - 12, y);
      context.stroke();
    }
    const values = series.flatMap((item) => item.data).filter((value) => Number.isFinite(value));
    if (!values.length) {
      context.fillText("Registre dados para gerar o grafico.", 34, 120);
      return;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    series.forEach((item, index) => {
      context.strokeStyle = item.color || [css("--blue"), css("--green"), css("--accent")][index % 3];
      context.lineWidth = 2.5;
      context.beginPath();
      item.data.forEach((value, pointIndex) => {
        const x = 34 + (pointIndex / Math.max(1, labels.length - 1)) * (rect.width - 54);
        const y = 214 - ((value - min) / span) * 176;
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    });
    context.fillText(labels[0] || "", 34, 238);
    context.fillText(labels.at(-1) || "", Math.max(34, rect.width - 70), 238);
  };

  const makeChart = (id, type, labels, datasets) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const prepared = datasets.map((dataset) => ({
      ...dataset,
      borderColor: dataset.borderColor || css("--blue"),
      backgroundColor: dataset.backgroundColor || `${css("--blue")}33`,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3
    }));
    if (!window.Chart) {
      fallbackLine(canvas, labels, prepared.map((dataset) => ({ data: dataset.data, color: dataset.borderColor })));
      return;
    }
    if (charts.has(id)) charts.get(id).destroy();
    charts.set(id, new Chart(canvas, {
      type,
      data: { labels, datasets: prepared },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: css("--muted"), boxWidth: 12 } } },
        scales: {
          x: { ticks: { color: css("--muted") }, grid: { color: css("--line") } },
          y: { ticks: { color: css("--muted") }, grid: { color: css("--line") } }
        }
      }
    }));
  };

  const expectedWeight = (metrics, entry) => {
    const totalDays = Math.max(1, Math.round((new Date(`${metrics.entries.at(-1)?.date || entry.date}T00:00:00`) - new Date(`${metrics.entries[0]?.date || entry.date}T00:00:00`)) / 86400000));
    const day = Math.max(0, Math.round((new Date(`${entry.date}T00:00:00`) - new Date(`${metrics.entries[0]?.date || entry.date}T00:00:00`)) / 86400000));
    return metrics.profile.initialWeight - ((metrics.profile.initialWeight - metrics.profile.targetWeight) * day) / totalDays;
  };

  const weeklyAdherence = (entries) => {
    const buckets = new Map();
    entries.forEach((entry) => {
      const date = new Date(`${entry.date}T00:00:00`);
      const key = `${date.getFullYear()}-S${Math.ceil((((date - new Date(date.getFullYear(), 0, 1)) / 86400000) + 1) / 7)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry.adherence || 0);
    });
    return [...buckets.entries()].map(([label, values]) => ({ label, value: values.reduce((a, b) => a + b, 0) / values.length })).slice(-10);
  };

  const weeklyAverage = (items, field) => {
    const buckets = new Map();
    items.forEach((item) => {
      const date = new Date(`${item.date}T00:00:00`);
      const key = `${date.getFullYear()}-S${Math.ceil((((date - new Date(date.getFullYear(), 0, 1)) / 86400000) + 1) / 7)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(Number(item[field] || 0));
    });
    return [...buckets.entries()].map(([label, values]) => ({
      label,
      value: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
    })).slice(-10);
  };

  const renderAll = (state, metrics) => {
    const entries = metrics.entries;
    const labels = entries.map((entry) => dateLabel(entry.date));
    const nutrition = metrics.nutritionDays || [];
    const nutritionLabels = nutrition.map((item) => dateLabel(item.date));
    makeChart("weightChart", "line", labels, [
      { label: "Real", data: entries.map((entry) => entry.weight || null), borderColor: css("--blue") },
      { label: "Esperado", data: entries.map((entry) => expectedWeight(metrics, entry)), borderColor: css("--green") }
    ]);
    makeChart("waistChart", "line", labels, [{ label: "Cintura", data: entries.map((entry) => entry.waist || null), borderColor: css("--accent") }]);
    const weekly = weeklyAdherence(entries);
    makeChart("adherenceChart", "bar", weekly.map((item) => item.label), [{ label: "Score", data: weekly.map((item) => Math.round(item.value)), backgroundColor: `${css("--green")}66`, borderColor: css("--green") }]);
    makeChart("proteinChart", "line", nutritionLabels, [
      { label: "Proteina", data: nutrition.map((item) => item.protein || null), borderColor: css("--green") },
      { label: "Meta", data: nutrition.map(() => metrics.profile.dailyProtein), borderColor: css("--muted") }
    ]);
    makeChart("caloriesChart", "line", nutritionLabels, [
      { label: "Calorias", data: nutrition.map((item) => item.calories || null), borderColor: css("--yellow") },
      { label: "Meta", data: nutrition.map(() => metrics.profile.dailyCalories), borderColor: css("--muted") }
    ]);
    makeChart("carbsChart", "line", nutritionLabels, [
      { label: "Carboidratos", data: nutrition.map((item) => item.carbs || null), borderColor: css("--blue") },
      { label: "Meta", data: nutrition.map(() => metrics.profile.dailyCarbs), borderColor: css("--muted") }
    ]);
    makeChart("fatsChart", "line", nutritionLabels, [
      { label: "Gorduras", data: nutrition.map((item) => item.fats || null), borderColor: css("--accent") },
      { label: "Meta", data: nutrition.map(() => metrics.profile.dailyFats), borderColor: css("--muted") }
    ]);
    const proteinWeekly = weeklyAverage(nutrition, "protein");
    const caloriesWeekly = weeklyAverage(nutrition, "calories");
    const carbsWeekly = weeklyAverage(nutrition, "carbs");
    const fatsWeekly = weeklyAverage(nutrition, "fats");
    const weeklyLabels = proteinWeekly.map((item) => item.label);
    makeChart("weeklyMacroChart", "line", weeklyLabels, [
      { label: "Proteina", data: proteinWeekly.map((item) => item.value), borderColor: css("--green") },
      { label: "Calorias/10", data: caloriesWeekly.map((item) => item.value / 10), borderColor: css("--yellow") },
      { label: "Carboidratos", data: carbsWeekly.map((item) => item.value), borderColor: css("--blue") },
      { label: "Gorduras", data: fatsWeekly.map((item) => item.value), borderColor: css("--accent") }
    ]);
    makeChart("bmiChart", "line", labels, [{ label: "IMC", data: entries.map((entry) => entry.weight ? entry.weight / (metrics.profile.height * metrics.profile.height) : null), borderColor: css("--blue") }]);
    makeChart("doseChart", "bar", state.injections.map((item) => dateLabel(item.date)), [{ label: "Dose mg", data: state.injections.map((item) => item.dose), backgroundColor: `${css("--accent")}66`, borderColor: css("--accent") }]);
  };

  window.HWPCharts = { renderAll };
})();
