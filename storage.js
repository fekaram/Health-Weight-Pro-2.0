(function () {
  "use strict";

  const KEY = "healthWeightPro2.state";
  const PROFILE = {
    initialWeight: 89,
    targetWeight: 70,
    height: 1.72,
    dailyProtein: 170,
    dailyCalories: 1900,
    dailyWaterMin: 3,
    dailyWaterMax: 4,
    dailySteps: 8000,
    dailySleep: 7.5
  };

  const emptyState = () => ({
    version: 1,
    profile: { ...PROFILE },
    entries: [],
    injections: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const normalizeDate = (value) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const byDateAsc = (a, b) => a.date.localeCompare(b.date);
  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  const newId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `hwp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return {
        ...emptyState(),
        ...parsed,
        profile: { ...PROFILE, ...(parsed.profile || {}) },
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        injections: Array.isArray(parsed.injections) ? parsed.injections : [],
        photos: Array.isArray(parsed.photos) ? parsed.photos : []
      };
    } catch (error) {
      console.warn("Falha ao carregar dados locais.", error);
      return emptyState();
    }
  };

  const write = (state) => {
    const next = { ...state, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  };

  const calculateAdherence = (entry) => {
    const checks = [
      Boolean(entry.waterDone || toNumber(entry.water) >= PROFILE.dailyWaterMin),
      Boolean(entry.proteinDone || toNumber(entry.protein) >= PROFILE.dailyProtein),
      Boolean(entry.caloriesDone || (toNumber(entry.calories) > 0 && toNumber(entry.calories) <= PROFILE.dailyCalories)),
      Boolean(entry.strengthDone),
      Boolean(entry.cardioDone),
      Boolean(entry.sleepDone || toNumber(entry.sleep) >= PROFILE.dailySleep),
      Boolean(entry.stepsDone || toNumber(entry.steps) >= PROFILE.dailySteps),
      Boolean(entry.applicationDone)
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const sanitizeEntry = (entry) => {
    const next = {
      date: normalizeDate(entry.date),
      weight: toNumber(entry.weight),
      waist: toNumber(entry.waist),
      protein: toNumber(entry.protein),
      calories: toNumber(entry.calories),
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
    next.adherence = calculateAdherence(next);
    return next;
  };

  const sanitizeInjection = (item) => ({
    id: item.id || newId(),
    date: normalizeDate(item.date),
    dose: toNumber(item.dose, 2.5),
    weight: toNumber(item.weight),
    severity: Math.max(0, Math.min(5, Math.round(toNumber(item.severity)))),
    sideEffects: Array.isArray(item.sideEffects) ? item.sideEffects.map(String) : [],
    notes: String(item.notes || "").trim()
  });

  const saveEntry = (entry) => {
    const state = read();
    const sanitized = sanitizeEntry(entry);
    state.entries = state.entries.filter((item) => item.date !== sanitized.date);
    state.entries.push(sanitized);
    state.entries.sort(byDateAsc);
    return write(state);
  };

  const deleteEntry = (date) => {
    const state = read();
    state.entries = state.entries.filter((item) => item.date !== normalizeDate(date));
    return write(state);
  };

  const saveInjection = (item) => {
    const state = read();
    state.injections.push(sanitizeInjection(item));
    state.injections.sort(byDateAsc);
    return write(state);
  };

  const savePhoto = (photo) => {
    const state = read();
    state.photos.push({
      id: photo.id || newId(),
      date: normalizeDate(photo.date),
      category: String(photo.category || "Frente"),
      image: photo.image,
      name: String(photo.name || "foto"),
      createdAt: new Date().toISOString()
    });
    state.photos.sort(byDateAsc);
    return write(state);
  };

  const deletePhoto = (id) => {
    const state = read();
    state.photos = state.photos.filter((photo) => photo.id !== id);
    return write(state);
  };

  const importState = (incoming) => {
    const base = emptyState();
    const next = {
      ...base,
      ...incoming,
      profile: { ...PROFILE, ...(incoming.profile || {}) },
      entries: (incoming.entries || []).map(sanitizeEntry).sort(byDateAsc),
      injections: (incoming.injections || []).map(sanitizeInjection).sort(byDateAsc),
      photos: Array.isArray(incoming.photos) ? incoming.photos : []
    };
    return write(next);
  };

  const getLatestEntry = (state = read()) => [...state.entries].sort(byDateDesc)[0] || null;

  const getFirstEntryWith = (state, field) =>
    [...state.entries].sort(byDateAsc).find((entry) => toNumber(entry[field]) > 0) || null;

  const average = (items, field) => {
    const values = items.map((item) => toNumber(item[field])).filter((value) => value > 0);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const daysBetween = (a, b) => {
    const start = new Date(`${normalizeDate(a)}T00:00:00`);
    const end = new Date(`${normalizeDate(b)}T00:00:00`);
    return Math.max(0, Math.round((end - start) / 86400000));
  };

  const calculateMetrics = (state = read()) => {
    const profile = state.profile;
    const entries = [...state.entries].sort(byDateAsc);
    const latest = getLatestEntry(state);
    const currentWeight = latest?.weight || profile.initialWeight;
    const firstDate = entries[0]?.date || new Date().toISOString().slice(0, 10);
    const latestDate = latest?.date || firstDate;
    const totalToLose = profile.initialWeight - profile.targetWeight;
    const lost = Math.max(0, profile.initialWeight - currentWeight);
    const remaining = Math.max(0, currentWeight - profile.targetWeight);
    const percent = totalToLose > 0 ? Math.max(0, Math.min(100, (lost / totalToLose) * 100)) : 0;
    const bmi = currentWeight / (profile.height * profile.height);
    const elapsedWeeks = Math.max(daysBetween(firstDate, latestDate) / 7, 0);
    const weeklyRate = elapsedWeeks > 0 ? lost / elapsedWeeks : 0;
    const weeksRemaining = weeklyRate > 0 ? remaining / weeklyRate : null;
    const estimatedDate = weeksRemaining
      ? new Date(new Date(`${latestDate}T00:00:00`).getTime() + weeksRemaining * 7 * 86400000)
      : null;
    const firstWaist = getFirstEntryWith(state, "waist");
    const currentWaist = latest?.waist || firstWaist?.waist || 0;
    const waistReduction = firstWaist && currentWaist ? Math.max(0, firstWaist.waist - currentWaist) : 0;
    const lastEntry = latest || {};
    const last7 = entries.slice(-7);
    const last5 = entries.slice(-5);
    const last3 = entries.slice(-3);
    const adherence = latest?.adherence || 0;

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
      averages: {
        protein7: average(last7, "protein"),
        calories7: average(last7, "calories"),
        water3: average(last3, "water"),
        protein5: average(last5, "protein")
      },
      lastEntry
    };
  };

  const generateAlerts = (metrics) => {
    const alerts = [];
    if (metrics.weeklyRate > metrics.currentWeight * 0.012) {
      alerts.push({
        title: "Atenção: velocidade de perda elevada",
        body: "Avalie aumento de proteína e calorias."
      });
    }
    if (metrics.entries.length >= 5 && metrics.averages.protein5 > 0 && metrics.averages.protein5 < 130) {
      alerts.push({
        title: "Risco aumentado de perda de massa muscular",
        body: "A proteína média ficou abaixo de 130 g nos últimos 5 dias."
      });
    }
    if (metrics.entries.length >= 3 && metrics.averages.water3 > 0 && metrics.averages.water3 < 2) {
      alerts.push({
        title: "Hidratação baixa",
        body: "A média dos últimos 3 dias ficou abaixo de 2 L."
      });
    }
    return alerts;
  };

  window.HWPStorage = {
    PROFILE,
    read,
    write,
    saveEntry,
    deleteEntry,
    saveInjection,
    savePhoto,
    deletePhoto,
    importState,
    calculateAdherence,
    calculateMetrics,
    generateAlerts,
    average,
    daysBetween,
    normalizeDate,
    toNumber
  };
})();
