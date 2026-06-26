(function () {
  "use strict";

  const KEY = "healthWeightPro1.state";
  const OLD_KEY = "healthWeightPro2.state";

  const PROFILE = {
    sex: "Masculino",
    age: 39,
    height: 1.72,
    initialWeight: 89,
    targetWeight: 70,
    initialWaist: 104,
    dailyProtein: 170,
    dailyCalories: 1900,
    dailyCarbs: 150,
    dailyFats: 65,
    dailyFiber: 25,
    dailyWaterMin: 3,
    dailyWaterMax: 4,
    dailySteps: 8000,
    dailySleep: 7.5
  };

  const OPTIONAL_MEALS = {
    snackMorning: true,
    preWorkout: true,
    postWorkout: true,
    afternoonSnack: true,
    supper: true
  };

  const MEAL_SLOTS = [
    { id: "breakfast", label: "\u2600\uFE0F Cafe da manha", fixed: true },
    { id: "snackMorning", label: "\uD83C\uDF4E Lanche da manha" },
    { id: "lunch", label: "\uD83C\uDF7D\uFE0F Almoco", fixed: true },
    { id: "preWorkout", label: "\uD83D\uDCAA Pre-treino" },
    { id: "postWorkout", label: "\uD83C\uDFCB\uFE0F Pos-treino" },
    { id: "afternoonSnack", label: "\u2615 Lanche da tarde" },
    { id: "dinner", label: "\uD83C\uDF19 Jantar", fixed: true },
    { id: "supper", label: "\uD83E\uDD5B Ceia" }
  ];

  const FAVORITES = [
    { name: "Omelete 3 ovos", calories: 240, protein: 21, carbs: 2, fats: 16, fiber: 0 },
    { name: "Whey 30 g", calories: 120, protein: 24, carbs: 3, fats: 2, fiber: 0 },
    { name: "Pao com requeijao", calories: 220, protein: 8, carbs: 32, fats: 7, fiber: 2 },
    { name: "Carne moida + arroz + brocolis", calories: 540, protein: 42, carbs: 52, fats: 18, fiber: 7 },
    { name: "Carne de panela + arroz", calories: 570, protein: 45, carbs: 58, fats: 17, fiber: 4 }
  ];

  const DEFAULT_NUTRI_SETTINGS = {
    apiKey: "",
    model: "gpt-5.5"
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const normalizeDate = (value) => String(value || today()).slice(0, 10);
  const toNumber = (value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const byDateAsc = (a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date));
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `hwp-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const emptyState = () => ({
    version: 1,
    profile: { ...PROFILE },
    optionalMeals: { ...OPTIONAL_MEALS },
    entries: [],
    meals: [],
    nutriAnalyses: [],
    nutriSettings: { ...DEFAULT_NUTRI_SETTINGS },
    workouts: [],
    injections: [],
    photos: [],
    favorites: FAVORITES.map((item) => ({ id: newId(), ...item })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const readRaw = () => localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);

  const normalizeState = (incoming = {}) => ({
    ...emptyState(),
    ...incoming,
    profile: { ...PROFILE, ...(incoming.profile || {}) },
    optionalMeals: { ...OPTIONAL_MEALS, ...(incoming.optionalMeals || {}) },
    entries: Array.isArray(incoming.entries) ? incoming.entries.map(sanitizeEntry).sort(byDateAsc) : [],
    meals: Array.isArray(incoming.meals) ? incoming.meals.map(sanitizeMeal).sort(byDateAsc) : [],
    nutriAnalyses: Array.isArray(incoming.nutriAnalyses) ? incoming.nutriAnalyses.map(sanitizeNutriAnalysis).sort(byDateAsc) : [],
    nutriSettings: { ...DEFAULT_NUTRI_SETTINGS, ...(incoming.nutriSettings || {}) },
    workouts: Array.isArray(incoming.workouts) ? incoming.workouts.map(sanitizeWorkout).sort(byDateAsc) : [],
    injections: Array.isArray(incoming.injections) ? incoming.injections.map(sanitizeInjection).sort(byDateAsc) : [],
    photos: Array.isArray(incoming.photos) ? incoming.photos : [],
    favorites: Array.isArray(incoming.favorites)
      ? incoming.favorites.map(sanitizeFavorite)
      : FAVORITES.map((item) => ({ id: newId(), ...item }))
  });

  const read = () => {
    try {
      const raw = readRaw();
      return raw ? normalizeState(JSON.parse(raw)) : emptyState();
    } catch (error) {
      console.warn("Falha ao carregar dados locais.", error);
      return emptyState();
    }
  };

  const write = (state) => {
    const next = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  };

  function calculateAdherence(entry, profile = PROFILE) {
    const checks = [
      Boolean(entry.waterDone || toNumber(entry.water) >= profile.dailyWaterMin),
      Boolean(entry.proteinDone || toNumber(entry.protein) >= profile.dailyProtein),
      Boolean(entry.caloriesDone || (toNumber(entry.calories) > 0 && toNumber(entry.calories) <= profile.dailyCalories)),
      Boolean(entry.strengthDone),
      Boolean(entry.cardioDone),
      Boolean(entry.sleepDone || toNumber(entry.sleep) >= profile.dailySleep),
      Boolean(entry.stepsDone || toNumber(entry.steps) >= profile.dailySteps),
      Boolean(entry.applicationDone)
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function sanitizeEntry(entry = {}) {
    const next = {
      date: normalizeDate(entry.date),
      weight: toNumber(entry.weight),
      waist: toNumber(entry.waist),
      protein: toNumber(entry.protein),
      calories: toNumber(entry.calories),
      carbs: toNumber(entry.carbs),
      fats: toNumber(entry.fats),
      fiber: toNumber(entry.fiber),
      steps: Math.round(toNumber(entry.steps)),
      water: toNumber(entry.water),
      sleep: toNumber(entry.sleep),
      notes: String(entry.notes || "").trim(),
      waterDone: Boolean(entry.waterDone),
      proteinDone: Boolean(entry.proteinDone),
      caloriesDone: Boolean(entry.caloriesDone),
      strengthDone: Boolean(entry.strengthDone),
      cardioDone: Boolean(entry.cardioDone),
      sleepDone: Boolean(entry.sleepDone),
      stepsDone: Boolean(entry.stepsDone),
      applicationDone: Boolean(entry.applicationDone)
    };
    next.adherence = Math.round(toNumber(entry.adherence, calculateAdherence(next)));
    return next;
  }

  function sanitizeMeal(meal = {}) {
    return {
      id: meal.id || newId(),
      date: normalizeDate(meal.date),
      slot: String(meal.slot || "breakfast"),
      description: String(meal.description || "").trim(),
      calories: toNumber(meal.calories),
      protein: toNumber(meal.protein),
      carbs: toNumber(meal.carbs),
      fats: toNumber(meal.fats),
      fiber: toNumber(meal.fiber),
      score: toNumber(meal.score),
      photo: meal.photo || "",
      source: String(meal.source || "manual"),
      analysisId: meal.analysisId || "",
      foods: Array.isArray(meal.foods) ? meal.foods : [],
      createdAt: meal.createdAt || new Date().toISOString()
    };
  }

  function sanitizeNutriFood(food = {}) {
    return {
      name: String(food.name || "Alimento").trim(),
      quantity: String(food.quantity || "").trim(),
      calories: Math.round(toNumber(food.calories)),
      protein: toNumber(food.protein),
      carbs: toNumber(food.carbs),
      fat: toNumber(food.fat),
      fiber: toNumber(food.fiber)
    };
  }

  function sanitizeNutriAnalysis(item = {}) {
    const foods = Array.isArray(item.foods) ? item.foods.map(sanitizeNutriFood) : [];
    const totals = item.totals || {};
    return {
      id: item.id || newId(),
      date: normalizeDate(item.date),
      type: item.type === "photo" ? "photo" : "text",
      inputText: String(item.inputText || "").trim(),
      photo: item.photo || "",
      foods,
      totals: {
        calories: Math.round(toNumber(totals.calories, sum(foods, "calories"))),
        protein: toNumber(totals.protein, sum(foods, "protein")),
        carbs: toNumber(totals.carbs, sum(foods, "carbs")),
        fat: toNumber(totals.fat, sum(foods, "fat")),
        fiber: toNumber(totals.fiber, sum(foods, "fiber"))
      },
      addedMealId: item.addedMealId || "",
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function sanitizeWorkout(item = {}) {
    return {
      id: item.id || newId(),
      date: normalizeDate(item.date),
      type: String(item.type || "Musculacao"),
      steps: Math.round(toNumber(item.steps)),
      minutes: Math.round(toNumber(item.minutes)),
      notes: String(item.notes || "").trim()
    };
  }

  function sanitizeInjection(item = {}) {
    return {
      id: item.id || newId(),
      date: normalizeDate(item.date),
      dose: toNumber(item.dose, 2.5),
      weight: toNumber(item.weight),
      severity: Math.max(0, Math.min(5, Math.round(toNumber(item.severity)))),
      sideEffects: Array.isArray(item.sideEffects) ? item.sideEffects.map(String) : [],
      notes: String(item.notes || "").trim()
    };
  }

  function sanitizeFavorite(item = {}) {
    return {
      id: item.id || newId(),
      name: String(item.name || "Refeicao").trim(),
      calories: toNumber(item.calories),
      protein: toNumber(item.protein),
      carbs: toNumber(item.carbs),
      fats: toNumber(item.fats ?? item.fat),
      fiber: toNumber(item.fiber),
      foods: Array.isArray(item.foods) ? item.foods.map(sanitizeNutriFood) : []
    };
  }

  const upsertByDate = (collection, item) => {
    const next = collection.filter((current) => normalizeDate(current.date) !== normalizeDate(item.date));
    next.push(item);
    return next.sort(byDateAsc);
  };

  const saveEntry = (entry) => {
    const state = read();
    const sanitized = sanitizeEntry(entry);
    const dayMeals = mealsForDate(state, sanitized.date);
    if (dayMeals.length) {
      const totals = nutritionForDate(state, sanitized.date);
      sanitized.calories = totals.calories;
      sanitized.protein = totals.protein;
      sanitized.carbs = totals.carbs;
      sanitized.fats = totals.fats;
      sanitized.fiber = totals.fiber;
      sanitized.proteinDone = totals.protein >= state.profile.dailyProtein;
      sanitized.caloriesDone = totals.calories > 0 && totals.calories <= state.profile.dailyCalories;
    }
    sanitized.adherence = calculateAdherence(sanitized, state.profile);
    state.entries = upsertByDate(state.entries, sanitized);
    return write(state);
  };

  const saveListItem = (key, item, sanitizer) => {
    const state = read();
    state[key].push(sanitizer(item));
    state[key].sort(byDateAsc);
    return write(state);
  };

  const nutritionForDate = (state, date) => {
    const meals = mealsForDate(state, date);
    return {
      calories: sum(meals, "calories"),
      protein: sum(meals, "protein"),
      carbs: sum(meals, "carbs"),
      fats: sum(meals, "fats"),
      fiber: sum(meals, "fiber")
    };
  };

  const syncEntryNutrition = (state, date) => {
    const normalized = normalizeDate(date);
    const totals = nutritionForDate(state, normalized);
    const existing = state.entries.find((entry) => entry.date === normalized);
    const next = sanitizeEntry({
      ...(existing || { date: normalized }),
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fats: totals.fats,
      fiber: totals.fiber,
      proteinDone: totals.protein >= state.profile.dailyProtein,
      caloriesDone: totals.calories > 0 && totals.calories <= state.profile.dailyCalories
    });
    next.adherence = calculateAdherence(next, state.profile);
    state.entries = upsertByDate(state.entries, next);
  };

  const deleteById = (key, id) => {
    const state = read();
    const removed = state[key].find((item) => item.id === id);
    state[key] = state[key].filter((item) => item.id !== id);
    if (key === "meals" && removed) syncEntryNutrition(state, removed.date);
    return write(state);
  };

  const deleteEntry = (date) => {
    const state = read();
    state.entries = state.entries.filter((item) => item.date !== normalizeDate(date));
    return write(state);
  };

  const savePhoto = (photo) => saveListItem("photos", {
    id: photo.id || newId(),
    date: normalizeDate(photo.date),
    category: String(photo.category || "Frente"),
    image: photo.image,
    name: String(photo.name || "foto"),
    createdAt: new Date().toISOString()
  }, (item) => item);

  const updateProfile = (profile, optionalMeals) => {
    const state = read();
    state.profile = { ...state.profile, ...profile };
    state.optionalMeals = { ...state.optionalMeals, ...optionalMeals };
    return write(state);
  };

  const updateNutriSettings = (settings) => {
    const state = read();
    state.nutriSettings = { ...state.nutriSettings, ...settings };
    return write(state);
  };

  const importState = (incoming) => write(normalizeState(incoming));
  const reset = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    return emptyState();
  };

  const activeMealSlots = (state = read()) => MEAL_SLOTS.filter((slot) => slot.fixed || state.optionalMeals[slot.id]);
  const slotLabel = (slotId) => MEAL_SLOTS.find((slot) => slot.id === slotId)?.label || slotId;
  const mealsForDate = (state, date) => state.meals.filter((meal) => meal.date === normalizeDate(date));
  const sum = (items, field) => items.reduce((total, item) => total + toNumber(item[field]), 0);
  const average = (items, field) => {
    const values = items.map((item) => toNumber(item[field])).filter((value) => value > 0);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  };
  const daysBetween = (a, b) => Math.max(0, Math.round((new Date(`${normalizeDate(b)}T00:00:00`) - new Date(`${normalizeDate(a)}T00:00:00`)) / 86400000));

  const calculateMetrics = (state = read()) => {
    const entries = [...state.entries].sort(byDateAsc);
    const latest = entries.at(-1) || null;
    const profile = state.profile;
    const currentWeight = latest?.weight || profile.initialWeight;
    const totalToLose = profile.initialWeight - profile.targetWeight;
    const lost = Math.max(0, profile.initialWeight - currentWeight);
    const remaining = Math.max(0, currentWeight - profile.targetWeight);
    const percent = totalToLose > 0 ? Math.max(0, Math.min(100, (lost / totalToLose) * 100)) : 0;
    const bmi = currentWeight / (profile.height * profile.height);
    const firstDate = entries[0]?.date || today();
    const latestDate = latest?.date || firstDate;
    const elapsedWeeks = Math.max(daysBetween(firstDate, latestDate) / 7, 0);
    const weeklyRate = elapsedWeeks > 0 ? lost / elapsedWeeks : 0;
    const weeksRemaining = weeklyRate > 0 ? remaining / weeklyRate : null;
    const estimatedDate = weeksRemaining ? new Date(new Date(`${latestDate}T00:00:00`).getTime() + weeksRemaining * 7 * 86400000) : null;
    const waistSource = [...entries].reverse().find((entry) => entry.waist > 0);
    const currentWaist = waistSource?.waist || profile.initialWaist;
    const waistReduction = Math.max(0, profile.initialWaist - currentWaist);
    const adherence = latest?.adherence || 0;
    const last7 = entries.slice(-7);
    const last5 = entries.slice(-5);
    const last3 = entries.slice(-3);
    const last30 = entries.slice(-30);
    const dayMeals = mealsForDate(state, today());
    const nutritionDays = nutritionSeries(state, 30);
    const nutritionLast5 = nutritionDays.slice(-5);
    return {
      profile,
      entries,
      latest,
      currentWeight,
      lost,
      remaining,
      percent,
      bmi,
      weeklyRate,
      estimatedDate,
      currentWaist,
      waistReduction,
      adherence,
      weeklyAdherence: average(last7, "adherence"),
      monthlyAdherence: average(last30, "adherence"),
      dayNutrition: {
        calories: sum(dayMeals, "calories"),
        protein: sum(dayMeals, "protein"),
        carbs: sum(dayMeals, "carbs"),
        fats: sum(dayMeals, "fats"),
        fiber: sum(dayMeals, "fiber")
      },
      nutritionDays,
      averages: {
        protein5: average(nutritionLast5, "protein"),
        calories5: average(nutritionLast5, "calories"),
        water3: average(last3, "water")
      }
    };
  };

  const generateAlerts = (metrics) => {
    const alerts = [];
    if (metrics.weeklyRate > metrics.currentWeight * 0.012) {
      alerts.push({ title: "Atencao: velocidade de perda elevada", body: "Avalie aumento de proteina e calorias." });
    }
    if (metrics.entries.length >= 5 && metrics.averages.protein5 > 0 && metrics.averages.protein5 < 130) {
      alerts.push({ title: "Risco aumentado de perda de massa muscular", body: "A proteina media ficou abaixo de 130 g nos ultimos 5 dias." });
    }
    if (metrics.dayNutrition.calories > 0 && metrics.dayNutrition.calories < 1200) {
      alerts.push({ title: "Atencao: ingestao muito baixa", body: "Ingestao muito baixa pode aumentar o risco de perda muscular." });
    }
    if (metrics.entries.length >= 3 && metrics.averages.water3 > 0 && metrics.averages.water3 < 2) {
      alerts.push({ title: "Hidratacao baixa", body: "A media dos ultimos 3 dias ficou abaixo de 2 L." });
    }
    return alerts;
  };

  function nutritionSeries(state, days = 30) {
    const dates = new Set([
      ...state.meals.map((meal) => meal.date),
      ...state.entries.map((entry) => entry.date)
    ]);
    return [...dates].sort().slice(-days).map((date) => ({ date, ...nutritionForDate(state, date) }));
  }

  const saveMeal = (meal) => {
    const state = read();
    const sanitized = sanitizeMeal(meal);
    state.meals = state.meals.filter((item) => item.id !== sanitized.id);
    state.meals.push(sanitized);
    state.meals.sort(byDateAsc);
    syncEntryNutrition(state, sanitized.date);
    return write(state);
  };

  const saveNutriAnalysis = (analysis) => saveListItem("nutriAnalyses", analysis, sanitizeNutriAnalysis);

  const markNutriAnalysisAdded = (analysisId, mealId) => {
    const state = read();
    state.nutriAnalyses = state.nutriAnalyses.map((item) => item.id === analysisId ? { ...item, addedMealId: mealId } : item);
    return write(state);
  };

  const saveFavorite = (item) => {
    const state = read();
    const sanitized = sanitizeFavorite(item);
    if (item.id && state.favorites.some((favorite) => favorite.id === item.id)) {
      state.favorites = state.favorites.map((favorite) => favorite.id === item.id ? sanitized : favorite);
    } else {
      state.favorites.push(sanitized);
    }
    return write(state);
  };

  const mealSuggestions = (state, query) => {
    const term = String(query || "").trim().toLowerCase();
    if (term.length < 2) return [];
    const fromFavorites = state.favorites.map((item) => ({
      label: item.name,
      source: "Favorita",
      meal: item
    }));
    const fromAnalyses = state.nutriAnalyses
      .filter((item) => item.inputText)
      .map((item) => ({
        label: item.inputText,
        source: "Historico",
        meal: {
          name: item.inputText,
          calories: item.totals.calories,
          protein: item.totals.protein,
          carbs: item.totals.carbs,
          fats: item.totals.fat,
          fiber: item.totals.fiber,
          foods: item.foods
        }
      }));
    return [...fromFavorites, ...fromAnalyses]
      .filter((item) => item.label.toLowerCase().includes(term) || term.includes(item.label.toLowerCase().slice(0, 8)))
      .slice(0, 6);
  };

  window.HWPStorage = {
    PROFILE,
    MEAL_SLOTS,
    read,
    write,
    reset,
    today,
    toNumber,
    normalizeDate,
    activeMealSlots,
    slotLabel,
    mealsForDate,
    calculateMetrics,
    calculateAdherence,
    generateAlerts,
    importState,
    updateProfile,
    saveEntry,
    deleteEntry,
    nutritionForDate,
    nutritionSeries,
    mealSuggestions,
    updateNutriSettings,
    saveMeal,
    deleteMeal: (id) => deleteById("meals", id),
    saveNutriAnalysis,
    markNutriAnalysisAdded,
    saveWorkout: (item) => saveListItem("workouts", item, sanitizeWorkout),
    deleteWorkout: (id) => deleteById("workouts", id),
    saveInjection: (item) => saveListItem("injections", item, sanitizeInjection),
    deleteInjection: (id) => deleteById("injections", id),
    savePhoto,
    deletePhoto: (id) => deleteById("photos", id),
    saveFavorite,
    deleteFavorite: (id) => deleteById("favorites", id)
  };
})();
