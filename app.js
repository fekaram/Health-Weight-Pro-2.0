(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const formatKg = (value) => `${Number(value || 0).toFixed(1).replace(".", ",")} kg`;
  const formatCm = (value) => (value ? `${Number(value).toFixed(1).replace(".", ",")} cm` : "-");
  const formatPercent = (value) => `${Math.round(value || 0)}%`;
  const formatDate = (date) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR") : "-");
  const today = () => new Date().toISOString().slice(0, 10);
  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  let state = HWPStorage.read();
  let metrics = HWPStorage.calculateMetrics(state);
  let toastTimer = null;

  const showToast = (message) => {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  };

  const refreshState = () => {
    state = HWPStorage.read();
    metrics = HWPStorage.calculateMetrics(state);
    render();
  };

  const scoreClass = (score) => {
    if (score >= 71) return "score-pill high";
    if (score >= 41) return "score-pill medium";
    return "score-pill";
  };

  const metricCard = ({ label, value, sub, wide = false, progress = null }) => `
    <article class="metric-card ${wide ? "wide" : ""}">
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        <div class="metric-sub">${sub}</div>
      </div>
      ${progress === null ? "" : `<div class="progress-track" aria-hidden="true"><div class="progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div></div>`}
    </article>`;

  const renderMetrics = () => {
    $("#scorePill").className = scoreClass(metrics.adherence);
    $("#scorePill").textContent = formatPercent(metrics.adherence);
    const estimated = metrics.estimatedDate ? metrics.estimatedDate.toLocaleDateString("pt-BR") : "Registre mais dias";
    $("#metricsGrid").innerHTML = [
      metricCard({
        label: "Peso atual",
        value: formatKg(metrics.currentWeight),
        sub: `Inicial ${formatKg(metrics.profile.initialWeight)} • Perdido ${formatKg(metrics.lost)} • Restante ${formatKg(metrics.remaining)}`,
        wide: true
      }),
      metricCard({
        label: "Meta",
        value: formatPercent(metrics.percent),
        sub: `Rumo a ${formatKg(metrics.profile.targetWeight)}`,
        wide: true,
        progress: metrics.percent
      }),
      metricCard({
        label: "IMC",
        value: metrics.bmi.toFixed(1).replace(".", ","),
        sub: `Altura ${metrics.profile.height.toFixed(2).replace(".", ",")} m`
      }),
      metricCard({
        label: "Taxa semanal",
        value: `${metrics.weeklyRate.toFixed(2).replace(".", ",")} kg`,
        sub: "kg perdidos por semana"
      }),
      metricCard({
        label: "Data estimada",
        value: estimated,
        sub: `Meta de ${formatKg(metrics.profile.targetWeight)}`
      }),
      metricCard({
        label: "Circunferência abdominal",
        value: formatCm(metrics.currentWaist),
        sub: `Redução total ${formatCm(metrics.waistReduction)}`
      })
    ].join("");
  };

  const renderAlerts = () => {
    const alerts = HWPStorage.generateAlerts(metrics);
    $("#alertList").innerHTML = alerts.length
      ? alerts.map((alert) => `<article class="alert-card"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.body)}</span></article>`).join("")
      : `<article class="alert-card"><strong>Sem alertas ativos</strong><span>Continue registrando seus dados para acompanhar tendências.</span></article>`;
  };

  const setFormCheckbox = (form, name, checked) => {
    const input = form.elements[name];
    if (input) input.checked = Boolean(checked);
  };

  const fillDailyForm = (entry = null) => {
    const form = $("#dailyForm");
    const data = entry || { date: today() };
    form.elements.date.value = data.date || today();
    ["weight", "waist", "protein", "calories", "steps", "water", "sleep", "notes"].forEach((name) => {
      form.elements[name].value = data[name] || "";
    });
    ["waterDone", "proteinDone", "caloriesDone", "strengthDone", "cardioDone", "sleepDone", "stepsDone", "applicationDone"].forEach((name) =>
      setFormCheckbox(form, name, data[name])
    );
    autoCheckGoals();
  };

  const autoCheckGoals = () => {
    const form = $("#dailyForm");
    const water = HWPStorage.toNumber(form.elements.water.value);
    const protein = HWPStorage.toNumber(form.elements.protein.value);
    const calories = HWPStorage.toNumber(form.elements.calories.value);
    const sleep = HWPStorage.toNumber(form.elements.sleep.value);
    const steps = HWPStorage.toNumber(form.elements.steps.value);
    if (water >= 3) form.elements.waterDone.checked = true;
    if (protein >= 170) form.elements.proteinDone.checked = true;
    if (calories > 0 && calories <= 1900) form.elements.caloriesDone.checked = true;
    if (sleep >= 7.5) form.elements.sleepDone.checked = true;
    if (steps >= 8000) form.elements.stepsDone.checked = true;
  };

  const entryFromForm = () => {
    const form = $("#dailyForm");
    return {
      date: form.elements.date.value,
      weight: form.elements.weight.value,
      waist: form.elements.waist.value,
      protein: form.elements.protein.value,
      calories: form.elements.calories.value,
      steps: form.elements.steps.value,
      water: form.elements.water.value,
      sleep: form.elements.sleep.value,
      notes: form.elements.notes.value,
      waterDone: form.elements.waterDone.checked,
      proteinDone: form.elements.proteinDone.checked,
      caloriesDone: form.elements.caloriesDone.checked,
      strengthDone: form.elements.strengthDone.checked,
      cardioDone: form.elements.cardioDone.checked,
      sleepDone: form.elements.sleepDone.checked,
      stepsDone: form.elements.stepsDone.checked,
      applicationDone: form.elements.applicationDone.checked
    };
  };

  const renderDailyHistory = () => {
    const recent = [...state.entries].reverse().slice(0, 12);
    $("#dailyHistory").innerHTML = recent.length
      ? recent.map((entry) => `
        <tr>
          <td>${formatDate(entry.date)}</td>
          <td>${formatKg(entry.weight)}</td>
          <td>${formatCm(entry.waist)}</td>
          <td>${formatPercent(entry.adherence)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" class="empty-state">Nenhum check-in salvo ainda.</td></tr>`;
  };

  const renderTirzepatideHistory = () => {
    const recent = [...state.injections].reverse();
    $("#tirzepatideHistory").innerHTML = recent.length
      ? recent.map((item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${String(item.dose).replace(".", ",")} mg</td>
          <td>${item.weight ? formatKg(item.weight) : "-"}</td>
          <td>${escapeHtml(item.sideEffects.join(", ") || "-")}</td>
          <td>${item.severity}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty-state">Nenhuma aplicação registrada ainda.</td></tr>`;
  };

  const renderPhotos = () => {
    const category = $("#photoCompareCategory").value;
    const photos = state.photos.filter((photo) => photo.category === category);
    $("#photoGrid").innerHTML = photos.length
      ? photos.map((photo) => `
        <article class="photo-card">
          <img src="${photo.image}" alt="Foto ${escapeHtml(photo.category)} em ${formatDate(photo.date)}">
          <footer>
            <span>${formatDate(photo.date)}</span>
            <button class="danger-button" type="button" data-delete-photo="${photo.id}">Excluir</button>
          </footer>
        </article>`).join("")
      : `<div class="empty-state">Adicione fotos para comparar mês a mês.</div>`;
  };

  const render = () => {
    renderMetrics();
    renderAlerts();
    renderDailyHistory();
    renderTirzepatideHistory();
    renderPhotos();
    window.requestAnimationFrame(() => HWPCharts.renderAll(state, metrics));
  };

  const switchView = (id) => {
    $$(".tab-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === id));
    $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === id));
    setTimeout(() => HWPCharts.renderAll(state, metrics), 80);
  };

  const initTabs = () => {
    $$(".tab-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
  };

  const initDailyForm = () => {
    const form = $("#dailyForm");
    fillDailyForm(state.entries.find((entry) => entry.date === today()) || metrics.latest);
    $("#fillTodayButton").addEventListener("click", () => fillDailyForm(state.entries.find((entry) => entry.date === today()) || { date: today() }));
    ["water", "protein", "calories", "sleep", "steps"].forEach((name) => form.elements[name].addEventListener("input", autoCheckGoals));
    form.elements.date.addEventListener("change", () => {
      const entry = state.entries.find((item) => item.date === form.elements.date.value);
      fillDailyForm(entry || { date: form.elements.date.value });
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      HWPStorage.saveEntry(entryFromForm());
      showToast("Check-in salvo.");
      refreshState();
    });
    $("#deleteEntryButton").addEventListener("click", () => {
      if (!form.elements.date.value) return;
      HWPStorage.deleteEntry(form.elements.date.value);
      showToast("Registro excluído.");
      refreshState();
      fillDailyForm({ date: form.elements.date.value });
    });
  };

  const initTirzepatideForm = () => {
    const form = $("#tirzepatideForm");
    form.elements.date.value = today();
    const severity = form.elements.severity;
    severity.addEventListener("input", () => {
      $("#severityOutput").textContent = severity.value;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const sideEffects = $$('input[name="sideEffects"]:checked', form).map((input) => input.value);
      HWPStorage.saveInjection({
        date: form.elements.date.value,
        dose: form.elements.dose.value,
        weight: form.elements.weight.value,
        severity: form.elements.severity.value,
        sideEffects,
        notes: form.elements.notes.value
      });
      form.reset();
      form.elements.date.value = today();
      $("#severityOutput").textContent = "0";
      showToast("Aplicação salva.");
      refreshState();
    });
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const initPhotos = () => {
    const form = $("#photoForm");
    form.elements.date.value = today();
    $("#photoCompareCategory").addEventListener("change", renderPhotos);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = form.elements.photo.files[0];
      if (!file) return;
      const image = await fileToDataUrl(file);
      HWPStorage.savePhoto({
        date: form.elements.date.value,
        category: form.elements.category.value,
        image,
        name: file.name
      });
      form.reset();
      form.elements.date.value = today();
      showToast("Foto salva localmente.");
      refreshState();
    });
    $("#photoGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-photo]");
      if (!button) return;
      HWPStorage.deletePhoto(button.dataset.deletePhoto);
      showToast("Foto excluída.");
      refreshState();
    });
  };

  const initBackup = () => {
    $("#exportJsonButton").addEventListener("click", () => HWPExport.exportJson(HWPStorage.read()));
    $("#exportExcelButton").addEventListener("click", () => HWPExport.exportExcel(HWPStorage.read()));
    $("#exportPdfButton").addEventListener("click", () => HWPExport.exportPdf(HWPStorage.read(), HWPStorage.calculateMetrics(HWPStorage.read())));
    $("#importJsonInput").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const incoming = await HWPExport.importJsonFile(file);
        HWPStorage.importState(incoming);
        showToast("Backup importado.");
        refreshState();
      } catch (error) {
        console.error(error);
        showToast("Não foi possível importar o JSON.");
      } finally {
        event.target.value = "";
      }
    });
  };

  const initModal = () => {
    const modal = $("#nutritionModal");
    $("#nutritionButton").addEventListener("click", () => {
      if (modal.showModal) modal.showModal();
    });
  };

  const initInstall = () => {
    const button = $("#installButton");
    const update = () => {
      button.hidden = !window.HWPPwa?.canInstall();
    };
    window.addEventListener("hwp-install-ready", update);
    button.addEventListener("click", async () => {
      const installed = await window.HWPPwa.install();
      if (installed) showToast("Instalação iniciada.");
      update();
    });
    update();
  };

  const init = () => {
    initTabs();
    initDailyForm();
    initTirzepatideForm();
    initPhotos();
    initBackup();
    initModal();
    initInstall();
    render();
    window.addEventListener("resize", () => HWPCharts.renderAll(state, metrics));
  };

  document.addEventListener("DOMContentLoaded", init);
})();
