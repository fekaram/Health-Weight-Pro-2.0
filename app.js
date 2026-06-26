console.log("APP.JS VERSAO TESTE 12345");
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => HWPStorage.today();
  const fmt = (value, suffix = "") => `${Number(value || 0).toFixed(1).replace(".", ",")}${suffix}`;
  const int = (value) => Math.round(Number(value || 0)).toLocaleString("pt-BR");
  const dateFmt = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR") : "-";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  let state = HWPStorage.read();
  let metrics = HWPStorage.calculateMetrics(state);
  let toastTimer = null;

  const showToast = (message) => {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const refresh = () => {
    state = HWPStorage.read();
    metrics = HWPStorage.calculateMetrics(state);
    render();
  };

  const scoreClass = (score) => score >= 71 ? "score-pill high" : score >= 41 ? "score-pill medium" : "score-pill";

  const metricCard = ({ label, value, sub, wide = false, progress = null }) => `
    <article class="metric-card ${wide ? "wide" : ""}">
      <div>
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        <div class="metric-sub">${sub}</div>
      </div>
      ${progress === null ? "" : `<div class="progress-track"><div class="progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div></div>`}
    </article>`;
  
const calculateDailyFoodScore = () => {
  const todayMeals = HWPStorage.mealsForDate(state, today());

  if (!todayMeals.length) return 0;

  const total = todayMeals.reduce(
    (sum, meal) => sum + Number(meal.score || 0),
    0
  );

  return Number((total / todayMeals.length).toFixed(1));
};
  
  const renderMetrics = () => {
    $("#scorePill").className = scoreClass(metrics.adherence);
    $("#scorePill").textContent = `${Math.round(metrics.adherence)}%`;
    const estimated = metrics.estimatedDate ? metrics.estimatedDate.toLocaleDateString("pt-BR") : "Registre mais dias";
    
    const dailyFoodScore = calculateDailyFoodScore();
    
    $("#metricsGrid").innerHTML = [
      metricCard({ label: "Peso atual", value: `${fmt(metrics.currentWeight, " kg")}`, sub: `Inicial ${fmt(metrics.profile.initialWeight, " kg")} | Perdido ${fmt(metrics.lost, " kg")} | Restante ${fmt(metrics.remaining, " kg")}`, wide: true }),
      metricCard({ label: "Meta", value: `${Math.round(metrics.percent)}%`, sub: `Rumo a ${fmt(metrics.profile.targetWeight, " kg")}`, wide: true, progress: metrics.percent }),
      metricCard({ label: "IMC", value: fmt(metrics.bmi), sub: `Altura ${fmt(metrics.profile.height, " m")}` }),
      metricCard({ label: "Taxa semanal", value: `${fmt(metrics.weeklyRate, " kg")}`, sub: "kg perdidos por semana" }),
      metricCard({ label: "Data estimada", value: estimated, sub: `Meta de ${fmt(metrics.profile.targetWeight, " kg")}` }),
      metricCard({ label: "Circunferencia abdominal", value: `${fmt(metrics.currentWaist, " cm")}`, sub: `Reducao acumulada ${fmt(metrics.waistReduction, " cm")}` }),
      metricCard({ label: "Score semanal", value: `${Math.round(metrics.weeklyAdherence)}%`, sub: "Media dos ultimos 7 registros" }),
      metricCard({ label: "Score mensal", value: `${Math.round(metrics.monthlyAdherence)}%`, sub: "Media dos ultimos 30 registros" }),
metricCard({
  label: "Score alimentar",
  value: `${dailyFoodScore}/10`,
  sub: "Media das refeicoes de hoje"
}),
      metricCard({ label: "Calorias do dia", value: `${int(metrics.dayNutrition.calories)} kcal`, sub: `Meta ${int(metrics.profile.dailyCalories)} kcal` }),
      metricCard({ label: "Proteina do dia", value: `${int(metrics.dayNutrition.protein)} g`, sub: `Meta ${int(metrics.profile.dailyProtein)} g` }),
      metricCard({ label: "Carboidratos do dia", value: `${int(metrics.dayNutrition.carbs)} g`, sub: `Meta ${int(metrics.profile.dailyCarbs)} g` }),
      metricCard({ label: "Gorduras do dia", value: `${int(metrics.dayNutrition.fats)} g`, sub: `Meta ${int(metrics.profile.dailyFats)} g` }),
      metricCard({ label: "Fibras do dia", value: `${int(metrics.dayNutrition.fiber)} g`, sub: `Meta ${int(metrics.profile.dailyFiber)} g` })
    ].join("");
  };

  const renderAlerts = () => {
    const alerts = HWPStorage.generateAlerts(metrics);
    $("#alertList").innerHTML = alerts.length
      ? alerts.map((alert) => `<article class="alert-card"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.body)}</span></article>`).join("")
      : `<article class="alert-card"><strong>Sem alertas ativos</strong><span>Continue registrando seus dados para acompanhar tendencias.</span></article>`;
  };

  const fillDailyForm = (entry = null) => {
    const form = $("#dailyForm");
    const data = entry || { date: today() };
    form.elements.date.value = data.date || today();
    ["weight", "waist", "protein", "calories", "steps", "water", "sleep", "notes"].forEach((name) => {
      form.elements[name].value = data[name] || "";
    });
    ["waterDone", "proteinDone", "caloriesDone", "strengthDone", "cardioDone", "sleepDone", "stepsDone", "applicationDone"].forEach((name) => {
      form.elements[name].checked = Boolean(data[name]);
    });
    autoCheckGoals();
  };

  const autoCheckGoals = () => {
    const form = $("#dailyForm");
    if (HWPStorage.toNumber(form.elements.water.value) >= state.profile.dailyWaterMin) form.elements.waterDone.checked = true;
    if (HWPStorage.toNumber(form.elements.protein.value) >= state.profile.dailyProtein) form.elements.proteinDone.checked = true;
    const calories = HWPStorage.toNumber(form.elements.calories.value);
    if (calories > 0 && calories <= state.profile.dailyCalories) form.elements.caloriesDone.checked = true;
    if (HWPStorage.toNumber(form.elements.sleep.value) >= state.profile.dailySleep) form.elements.sleepDone.checked = true;
    if (HWPStorage.toNumber(form.elements.steps.value) >= state.profile.dailySteps) form.elements.stepsDone.checked = true;
  };

  const entryFromForm = () => {
    const form = $("#dailyForm");
    return {
      date: form.elements.date.value,
      weight: form.elements.weight.value,
      waist: form.elements.waist.value,
      water: form.elements.water.value,
      protein: form.elements.protein.value,
      calories: form.elements.calories.value,
      steps: form.elements.steps.value,
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
    $("#dailyHistory").innerHTML = state.entries.length
      ? [...state.entries].reverse().slice(0, 14).map((entry) => `<tr><td>${dateFmt(entry.date)}</td><td>${fmt(entry.weight, " kg")}</td><td>${fmt(entry.waist, " cm")}</td><td>${entry.adherence || 0}%</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty-state">Nenhum check-in salvo ainda.</td></tr>`;
  };

  const renderMealControls = () => {
    const select = $("#mealForm").elements.slot;
    select.innerHTML = HWPStorage.activeMealSlots(state).map((slot) => `<option value="${slot.id}">${slot.label}</option>`).join("");
  };

  const renderDayNutrition = () => {
    const formDate = $("#mealForm").elements.date.value || today();
    const meals = HWPStorage.mealsForDate(state, formDate);
    const total = (field) => meals.reduce((sum, meal) => sum + HWPStorage.toNumber(meal[field]), 0);
    const cards = [
      ["Consumido", `${int(total("calories"))} kcal`, `${int(total("protein"))} g proteina`],
      ["Meta", `${int(state.profile.dailyCalories)} kcal`, `${int(state.profile.dailyProtein)} g proteina`],
      ["Restante kcal", `${int(Math.max(0, state.profile.dailyCalories - total("calories")))} kcal`, "ate a meta"],
      ["Restante proteina", `${int(Math.max(0, state.profile.dailyProtein - total("protein")))} g`, "para bater a meta"],
      ["Carboidratos", `${int(total("carbs"))} g`, `meta ${int(state.profile.dailyCarbs)} g`],
      ["Gorduras", `${int(total("fats"))} g`, `meta ${int(state.profile.dailyFats)} g`],
      ["Fibras", `${int(total("fiber"))} g`, `meta ${int(state.profile.dailyFiber)} g`],
      ["Sugestao do dia", nutritionSuggestion(total("calories"), total("protein")), "assistente nutricional"]
    ];
    $("#dayNutritionSummary").innerHTML = cards.map(([label, value, sub]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><span>${sub}</span></article>`).join("");
  };

  const nutritionSuggestion = (calories, protein) => {
    const remainingCalories = Math.max(0, state.profile.dailyCalories - calories);
    const remainingProtein = Math.max(0, state.profile.dailyProtein - protein);
    if (remainingProtein >= 45 && remainingCalories >= 350) return `Faltam ${int(remainingProtein)} g P e ${int(remainingCalories)} kcal. Sugestao: 200 g frango + legumes + iogurte proteico.`;
    if (remainingProtein >= 25) return `Faltam ${int(remainingProtein)} g P. Sugestao: whey, ovos ou iogurte proteico.`;
    if (remainingCalories <= 150 && remainingProtein <= 15) return "Metas principais bem encaminhadas. Priorize agua, fibras e sono.";
    return `Restam ${int(remainingCalories)} kcal e ${int(remainingProtein)} g P. Monte uma refeicao leve e rica em proteina.`;
  };

  const renderMeals = () => {
    renderMealControls();
    renderDayNutrition();
    const formDate = $("#mealForm").elements.date.value || today();
    const meals = HWPStorage.mealsForDate(state, formDate);
    $("#mealDay").innerHTML = HWPStorage.activeMealSlots(state).map((slot) => {
      const items = meals.filter((meal) => meal.slot === slot.id);
      const body = items.length ? items.map((meal) => `
        <article class="meal-card">
          ${meal.photo ? `<img src="${meal.photo}" alt="Foto da refeicao">` : ""}
          <strong>${escapeHtml(meal.description)}</strong>

<p>${int(meal.calories)} kcal | ${int(meal.protein)} g P | ${int(meal.carbs)} g C | ${int(meal.fats)} g G | ${int(meal.fiber)} g fibras</p>

<p>
  <strong class="${
    meal.score >= 9 ? "score-green" :
    meal.score >= 7 ? "score-blue" :
    meal.score >= 5 ? "score-yellow" :
    "score-red"
  }">
    ⭐ Nota: ${meal.score || 0}/10
  </strong>
</p>

<footer><span>${slot.label}</span><button class="danger-button" type="button" data-delete-meal="${meal.id}">Excluir</button></footer>
        </article>`).join("") : `<article class="meal-card"><strong>${slot.label}</strong><p>Nenhuma refeicao registrada.</p></article>`;
      return body;
    }).join("");
  };

  const renderWorkoutHistory = () => {
    $("#workoutHistory").innerHTML = state.workouts.length
      ? [...state.workouts].reverse().map((item) => `<tr><td>${dateFmt(item.date)}</td><td>${escapeHtml(item.type)}</td><td>${int(item.steps)}</td><td>${int(item.minutes)} min</td><td><button class="danger-button" type="button" data-delete-workout="${item.id}">Excluir</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="empty-state">Nenhum treino registrado ainda.</td></tr>`;
  };

  const renderTirzepatideHistory = () => {
    $("#tirzepatideHistory").innerHTML = state.injections.length
      ? [...state.injections].reverse().map((item) => `<tr><td>${dateFmt(item.date)}</td><td>${String(item.dose).replace(".", ",")} mg</td><td>${item.weight ? fmt(item.weight, " kg") : "-"}</td><td>${escapeHtml(item.sideEffects.join(", ") || "-")}</td><td>${item.severity}</td><td><button class="danger-button" type="button" data-delete-injection="${item.id}">Excluir</button></td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">Nenhuma aplicacao registrada ainda.</td></tr>`;
  };

  const renderPhotos = () => {
    const category = $("#photoCompareCategory").value;
    const photos = state.photos.filter((photo) => photo.category === category);
    $("#photoGrid").innerHTML = photos.length
      ? photos.map((photo) => `<article class="photo-card"><img src="${photo.image}" alt="Foto ${escapeHtml(photo.category)}"><footer><span>${dateFmt(photo.date)}</span><button class="danger-button" type="button" data-delete-photo="${photo.id}">Excluir</button></footer></article>`).join("")
      : `<div class="empty-state">Adicione fotos para comparar mes a mes.</div>`;
  };

  const renderFavorites = () => {
    $("#favoriteList").innerHTML = state.favorites.map((item) => `
      <article class="favorite-card">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${int(item.calories)} kcal | ${int(item.protein)} g P | ${int(item.carbs)} g C | ${int(item.fats)} g G | ${int(item.fiber)} g fibras</p>
        <footer>
          <button class="secondary-button" type="button" data-add-favorite="${item.id}">Adicionar novamente</button>
          <button class="secondary-button" type="button" data-edit-favorite="${item.id}">Editar</button>
          <button class="danger-button" type="button" data-delete-favorite="${item.id}">Excluir</button>
        </footer>
      </article>`).join("");
  };

const render = () => {
  renderMetrics();
  renderAlerts();
  renderDailyHistory();
  renderMeals();
  renderWorkoutHistory();
  renderTirzepatideHistory();
  renderPhotos();
  renderFavorites();

  HWPSettings.fill($("#settingsForm"), state);

  requestAnimationFrame(() => HWPCharts.renderAll(state, metrics));
};
  };

  const switchView = (id) => {
    $$(".tab-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === id));
    $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === id));
    setTimeout(() => HWPCharts.renderAll(state, metrics), 80);
  };

  const initTheme = () => {
    const saved = localStorage.getItem("healthWeightPro1.theme");
    if (saved) document.documentElement.dataset.theme = saved;
    $("#themeButton").addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      const next = current === "dark" ? "light" : current === "light" ? "" : "dark";
      if (next) document.documentElement.dataset.theme = next;
      else delete document.documentElement.dataset.theme;
      localStorage.setItem("healthWeightPro1.theme", next);
    });
  };

  const initForms = () => {
    fillDailyForm(state.entries.find((entry) => entry.date === today()) || { date: today() });
    const mealForm = $("#mealForm");
if (mealForm) mealForm.elements.date.value = today();

const chatgptForm = $("#chatgptImportForm");
if (chatgptForm) chatgptForm.elements.date.value = today();

const workoutForm = $("#workoutForm");
if (workoutForm) workoutForm.elements.date.value = today();

const tirzepatideForm = $("#tirzepatideForm");
if (tirzepatideForm) tirzepatideForm.elements.date.value = today();

const photoForm = $("#photoForm");
if (photoForm) photoForm.elements.date.value = today();

    $$(".tab-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#fillTodayButton").addEventListener("click", () => fillDailyForm(state.entries.find((entry) => entry.date === today()) || { date: today() }));
    ["water", "protein", "calories", "sleep", "steps"].forEach((name) => $("#dailyForm").elements[name].addEventListener("input", autoCheckGoals));
    $("#dailyForm").elements.date.addEventListener("change", () => fillDailyForm(state.entries.find((entry) => entry.date === $("#dailyForm").elements.date.value) || { date: $("#dailyForm").elements.date.value }));
    $("#dailyForm").addEventListener("submit", (event) => {
      event.preventDefault();
      HWPStorage.saveEntry(entryFromForm());
      showToast("Check-in salvo.");
      refresh();
    });
    $("#deleteEntryButton").addEventListener("click", () => {
      HWPStorage.deleteEntry($("#dailyForm").elements.date.value);
      showToast("Registro excluido.");
      refresh();
      fillDailyForm({ date: $("#dailyForm").elements.date.value || today() });
    });

    $("#mealForm").elements.date.addEventListener("change", renderMeals);
    $("#mealForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      HWPStorage.saveMeal({
        date: form.elements.date.value,
        slot: form.elements.slot.value,
        description: form.elements.description.value,
        calories: form.elements.calories.value,
        protein: form.elements.protein.value,
        carbs: form.elements.carbs.value,
        fats: form.elements.fats.value,
        fiber: form.elements.fiber.value,
        photo: await readFileAsDataUrl(form.elements.photo.files[0])
      });
      form.reset();
      form.elements.date.value = today();
      showToast("Refeicao salva.");
      refresh();
    });
    $("#saveFavoriteFromMealButton").addEventListener("click", () => {
      const form = $("#mealForm");
      if (!form.elements.description.value.trim()) return showToast("Informe a descricao da refeicao.");
      HWPStorage.saveFavorite({
        name: form.elements.description.value,
        calories: form.elements.calories.value,
        protein: form.elements.protein.value,
        carbs: form.elements.carbs.value,
        fats: form.elements.fats.value,
        fiber: form.elements.fiber.value
      });
      showToast("Favorita salva.");
      refresh();
    });

```javascript
// ======================
// NUTRI IA+
// ======================

const parseHWPFood = (text) => {
  const lines = text.trim().split("\n");

  if (lines[0].trim() !== "HWP_FOOD") {
    throw new Error("Formato inválido. O código deve iniciar com HWP_FOOD.");
  }

  const data = {};

  lines.slice(1).forEach((line) => {
    const [key, ...rest] = line.split("=");
    data[key.trim()] = rest.join("=").trim();
  });

  return {
    slot: data.slot || "lunch",
    name: data.name || "Refeição",
    calories: Number(data.calories || 0),
    protein: Number(data.protein || 0),
    carbs: Number(data.carbs || 0),
    fat: Number(data.fat || 0),
    fiber: Number(data.fiber || 0)
  };
};

$("#importChatGPTButton").addEventListener("click", () => {

  try {

    const form = $("#chatgptImportForm");

    if (!form) {
      throw new Error("Formulário não encontrado.");
    }

    const text = $("#chatgptImportText").value;

    const meal = parseHWPFood(text);

    HWPStorage.saveMeal({
      date: form.elements.date.value,
      slot: meal.slot,
      description: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fat,
      fiber: meal.fiber
    });

    showToast("Refeição importada com sucesso.");

    form.reset();
    form.elements.date.value = today();

    refresh();

  } catch (error) {

    console.error(error);
    alert(error.message);

  }

});

$("#clearChatGPTImportButton").addEventListener("click", () => {

  const form = $("#chatgptImportForm");

  if (!form) return;

  form.reset();
  form.elements.date.value = today();

});

    $("#workoutForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      HWPStorage.saveWorkout({ date: form.elements.date.value, type: form.elements.type.value, steps: form.elements.steps.value, minutes: form.elements.minutes.value, notes: form.elements.notes.value });
      form.reset();
      form.elements.date.value = today();
      showToast("Treino salvo.");
      refresh();
    });

    const severity = $("#tirzepatideForm").elements.severity;
    severity.addEventListener("input", () => { $("#severityOutput").textContent = severity.value; });
    $("#tirzepatideForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      HWPStorage.saveInjection({
        date: form.elements.date.value,
        dose: form.elements.dose.value,
        weight: form.elements.weight.value,
        severity: form.elements.severity.value,
        sideEffects: $$('input[name="sideEffects"]:checked', form).map((input) => input.value),
        notes: form.elements.notes.value
      });
      form.reset();
      form.elements.date.value = today();
      $("#severityOutput").textContent = "0";
      showToast("Aplicacao salva.");
      refresh();
    });

    $("#photoForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.elements.photo.files[0];
      HWPStorage.savePhoto({ date: form.elements.date.value, category: form.elements.category.value, image: await readFileAsDataUrl(file), name: file?.name });
      form.reset();
      form.elements.date.value = today();
      showToast("Foto salva.");
      refresh();
    });
    $("#photoCompareCategory").addEventListener("change", renderPhotos);

    $("#favoriteForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      HWPStorage.saveFavorite({ id: form.elements.id.value, name: form.elements.name.value, calories: form.elements.calories.value, protein: form.elements.protein.value, carbs: form.elements.carbs.value, fats: form.elements.fats.value, fiber: form.elements.fiber.value });
      form.reset();
      showToast("Favorita salva.");
      refresh();
    });
    $("#clearFavoriteFormButton").addEventListener("click", () => $("#favoriteForm").reset());

    $("#settingsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = HWPSettings.read(event.currentTarget);
      HWPStorage.updateProfile(data.profile, data.optionalMeals);
      HWPStorage.updateNutriSettings(data.nutriSettings);
      showToast("Ajustes salvos.");
      refresh();
    });

  };

  const initActions = () => {
    document.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.deleteMeal) HWPStorage.deleteMeal(target.dataset.deleteMeal);
      else if (target.dataset.deleteWorkout) HWPStorage.deleteWorkout(target.dataset.deleteWorkout);
      else if (target.dataset.deleteInjection) HWPStorage.deleteInjection(target.dataset.deleteInjection);
      else if (target.dataset.deletePhoto) HWPStorage.deletePhoto(target.dataset.deletePhoto);
      else if (target.dataset.deleteFavorite) HWPStorage.deleteFavorite(target.dataset.deleteFavorite);
      else if (target.dataset.addFavorite) {
        const item = state.favorites.find((favorite) => favorite.id === target.dataset.addFavorite);
        if (item) {
          HWPStorage.saveMeal({ date: $("#mealForm").elements.date.value || today(), slot: $("#mealForm").elements.slot.value || "breakfast", description: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fats: item.fats, fiber: item.fiber, foods: item.foods });
          switchView("mealsView");
        }
      } else if (target.dataset.editFavorite) {
        const item = state.favorites.find((favorite) => favorite.id === target.dataset.editFavorite);
        if (item) {
          const form = $("#favoriteForm");
          form.elements.id.value = item.id;
          form.elements.name.value = item.name;
          form.elements.calories.value = item.calories;
          form.elements.protein.value = item.protein;
          form.elements.carbs.value = item.carbs;
          form.elements.fats.value = item.fats;
          form.elements.fiber.value = item.fiber;
          switchView("libraryView");
        }
      } else return;
      showToast("Dados atualizados.");
      refresh();
    });

    $("#nutritionPlanButton").addEventListener("click", () => $("#nutritionPlanModal").showModal());
    $("[data-close-modal]").addEventListener("click", () => $("#nutritionPlanModal").close());
    $("#exportCsvButton").addEventListener("click", () => HWPExport.exportCsv(state));
    $("#exportExcelButton").addEventListener("click", () => HWPExport.exportExcel(state));
    $("#exportPdfButton").addEventListener("click", () => HWPExport.exportPdf(state, metrics));
    $("#exportJsonButton").addEventListener("click", () => HWPExport.exportJson(state));
    $("#importJsonInput").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        HWPStorage.importState(await HWPExport.importJsonFile(file));
        showToast("Backup importado.");
        refresh();
      } catch (error) {
        console.warn("Falha ao importar backup JSON.", error);
        showToast("Nao foi possivel importar o JSON.");
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initForms();
    initActions();
    HWPPWA.init();
    render();
  });
})();
