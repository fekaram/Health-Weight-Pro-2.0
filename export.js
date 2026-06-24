(function () {
  "use strict";

  const download = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const dateStamp = () => new Date().toISOString().slice(0, 10);

  const rowsFromState = (state) => {
    const rows = [["tipo", "data", "campo_1", "campo_2", "campo_3", "campo_4", "observacoes"]];
    state.entries.forEach((item) => rows.push(["checkin", item.date, item.weight, item.waist, item.calories, item.protein, item.notes]));
    state.meals.forEach((item) => rows.push(["refeicao", item.date, HWPStorage.slotLabel(item.slot), item.calories, `${item.protein}g P / ${item.carbs}g C / ${item.fats}g G / ${item.fiber}g fibras`, item.description, item.source || "manual"]));
    (state.nutriAnalyses || []).forEach((item) => rows.push(["nutri_ia", item.date, item.type, item.totals.calories, `${item.totals.protein}g P / ${item.totals.carbs}g C / ${item.totals.fat}g G / ${item.totals.fiber}g fibras`, item.inputText, item.addedMealId ? "adicionada" : "analise"]));
    state.workouts.forEach((item) => rows.push(["treino", item.date, item.type, item.steps, item.minutes, "", item.notes]));
    state.injections.forEach((item) => rows.push(["tirzepatida", item.date, `${item.dose} mg`, item.weight, item.severity, item.sideEffects.join("; "), item.notes]));
    return rows;
  };

  const exportCsv = (state) => {
    const csv = rowsFromState(state).map((row) => row.map(csvEscape).join(",")).join("\n");
    download(`health-weight-pro-${dateStamp()}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  };

  const exportJson = (state) => {
    const safeState = {
      ...state,
      nutriSettings: { ...(state.nutriSettings || {}), apiKey: "" }
    };
    download(`health-weight-pro-backup-${dateStamp()}.json`, new Blob([JSON.stringify(safeState, null, 2)], { type: "application/json" }));
  };

  const exportExcel = (state) => {
    if (window.XLSX) {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.entries), "Checkins");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.meals), "Refeicoes");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.nutriAnalyses || []), "Nutri IA");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.workouts), "Treinos");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.injections), "Tirzepatida");
      XLSX.writeFile(workbook, `health-weight-pro-${dateStamp()}.xlsx`);
      return;
    }
    const html = rowsFromState(state).map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`).join("");
    download(`health-weight-pro-${dateStamp()}.xls`, new Blob([`<table>${html}</table>`], { type: "application/vnd.ms-excel" }));
  };

  const exportPdf = (state, metrics) => {
    const lines = [
      "Health Weight Pro 1.0",
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      "",
      `Peso atual: ${metrics.currentWeight.toFixed(1)} kg`,
      `Peso perdido: ${metrics.lost.toFixed(1)} kg`,
      `Meta concluida: ${Math.round(metrics.percent)}%`,
      `IMC: ${metrics.bmi.toFixed(1)}`,
      `Score diario: ${Math.round(metrics.adherence)}%`,
      `Score semanal: ${Math.round(metrics.weeklyAdherence)}%`,
      `Score mensal: ${Math.round(metrics.monthlyAdherence)}%`,
      "",
      "Historico recente:",
      ...state.entries.slice(-12).map((item) => `${item.date} | ${item.weight || "-"} kg | ${item.calories || 0} kcal | ${item.protein || 0} g proteina | ${item.carbs || 0} g carbo | ${item.fats || 0} g gordura | score ${item.adherence || 0}%`)
    ];
    if (window.jspdf?.jsPDF) {
      const doc = new window.jspdf.jsPDF();
      let y = 14;
      lines.forEach((line) => {
        doc.text(String(line), 12, y);
        y += 7;
        if (y > 280) {
          doc.addPage();
          y = 14;
        }
      });
      doc.save(`health-weight-pro-${dateStamp()}.pdf`);
      return;
    }
    download(`health-weight-pro-${dateStamp()}.txt`, new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
  };

  const importJsonFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

  window.HWPExport = { exportCsv, exportExcel, exportPdf, exportJson, importJsonFile };
})();
