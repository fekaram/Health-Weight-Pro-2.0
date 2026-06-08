(function () {
  "use strict";

  const downloadBlob = (content, filename, type) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const formatDateTime = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const entryRows = (state) =>
    state.entries.map((entry) => ({
      Data: entry.date,
      Peso: entry.weight,
      Cintura: entry.waist,
      Proteina: entry.protein,
      Calorias: entry.calories,
      Passos: entry.steps,
      Agua: entry.water,
      Sono: entry.sleep,
      Aderencia: entry.adherence,
      Musculacao: entry.strengthDone ? "Sim" : "Nao",
      Cardio: entry.cardioDone ? "Sim" : "Nao",
      Aplicacao: entry.applicationDone ? "Sim" : "Nao",
      Observacoes: entry.notes
    }));

  const injectionRows = (state) =>
    state.injections.map((item) => ({
      Data: item.date,
      Dose: `${String(item.dose).replace(".", ",")} mg`,
      Peso: item.weight,
      Escala: item.severity,
      Efeitos: item.sideEffects.join(", "),
      Observacoes: item.notes
    }));

  const exportJson = (state) => {
    downloadBlob(JSON.stringify(state, null, 2), `health-weight-pro-backup-${formatDateTime()}.json`, "application/json;charset=utf-8");
  };

  const importJsonFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const exportExcel = (state) => {
    const rows = entryRows(state);
    const injections = injectionRows(state);
    if (window.XLSX) {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Check-ins");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(injections), "Tirzepatida");
      XLSX.writeFile(workbook, `health-weight-pro-${formatDateTime()}.xlsx`);
      return;
    }

    const table = (title, data) => {
      const keys = Object.keys(data[0] || { SemDados: "" });
      const head = keys.map((key) => `<th>${key}</th>`).join("");
      const body = data.length
        ? data.map((row) => `<tr>${keys.map((key) => `<td>${row[key] ?? ""}</td>`).join("")}</tr>`).join("")
        : `<tr><td></td></tr>`;
      return `<h2>${title}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    };

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${table("Check-ins", rows)}${table("Tirzepatida", injections)}</body></html>`;
    downloadBlob(html, `health-weight-pro-${formatDateTime()}.xls`, "application/vnd.ms-excel;charset=utf-8");
  };

  const metricList = (metrics) => [
    ["Peso atual", `${metrics.currentWeight.toFixed(1)} kg`],
    ["Peso perdido", `${metrics.lost.toFixed(1)} kg`],
    ["Peso restante", `${metrics.remaining.toFixed(1)} kg`],
    ["Meta concluida", `${metrics.percent.toFixed(0)}%`],
    ["IMC", metrics.bmi.toFixed(1)],
    ["Taxa semanal", `${metrics.weeklyRate.toFixed(2)} kg/semana`],
    ["Cintura atual", metrics.currentWaist ? `${metrics.currentWaist.toFixed(1)} cm` : "-"],
    ["Reducao de cintura", `${metrics.waistReduction.toFixed(1)} cm`]
  ];

  const exportPdf = async (state, metrics) => {
    const alerts = HWPStorage.generateAlerts(metrics);
    if (window.jspdf?.jsPDF) {
      const pdf = new jspdf.jsPDF({ unit: "pt", format: "a4" });
      let y = 42;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Health Weight Pro 2.0", 40, y);
      y += 26;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      metricList(metrics).forEach(([label, value]) => {
        pdf.text(`${label}: ${value}`, 40, y);
        y += 17;
      });
      if (alerts.length) {
        y += 8;
        pdf.setFont("helvetica", "bold");
        pdf.text("Alertas", 40, y);
        y += 16;
        pdf.setFont("helvetica", "normal");
        alerts.forEach((alert) => {
          pdf.text(`- ${alert.title}. ${alert.body}`, 40, y, { maxWidth: 510 });
          y += 26;
        });
      }

      HWPCharts.getImages().forEach((chart, index) => {
        if (index % 2 === 0 || y > 640) {
          pdf.addPage();
          y = 42;
        }
        pdf.addImage(chart.image, "PNG", 40, y, 510, 230);
        y += 252;
      });
      pdf.save(`health-weight-pro-relatorio-${formatDateTime()}.pdf`);
      return;
    }

    const rows = entryRows(state).slice(-30);
    const popup = window.open("", "_blank");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Relatório Health Weight Pro</title>
          <style>
            body{font-family:system-ui,-apple-system,sans-serif;margin:32px;color:#111}
            h1{margin-bottom:8px}
            .metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:20px 0}
            .metric{border:1px solid #ddd;border-radius:8px;padding:12px}
            img{width:100%;max-width:720px;margin:12px 0;border:1px solid #ddd;border-radius:8px}
            table{border-collapse:collapse;width:100%;font-size:12px}
            th,td{border-bottom:1px solid #ddd;text-align:left;padding:8px}
          </style>
        </head>
        <body>
          <h1>Health Weight Pro 2.0</h1>
          <p>Relatório gerado em ${new Date().toLocaleString("pt-BR")}.</p>
          <section class="metrics">${metricList(metrics).map(([label, value]) => `<div class="metric"><strong>${label}</strong><br>${value}</div>`).join("")}</section>
          <h2>Alertas</h2>
          ${alerts.length ? `<ul>${alerts.map((alert) => `<li>${alert.title}. ${alert.body}</li>`).join("")}</ul>` : "<p>Nenhum alerta ativo.</p>"}
          <h2>Gráficos</h2>
          ${HWPCharts.getImages().map((chart) => `<img src="${chart.image}" alt="${chart.id}">`).join("")}
          <h2>Histórico recente</h2>
          <table><thead><tr>${Object.keys(rows[0] || { Data: "" }).map((key) => `<th>${key}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${value ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
          <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
        </body>
      </html>`);
    popup.document.close();
  };

  window.HWPExport = {
    exportJson,
    importJsonFile,
    exportExcel,
    exportPdf
  };
})();
