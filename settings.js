(function () {
  "use strict";

  const fields = ["initialWeight", "targetWeight", "height", "dailyCalories", "dailyProtein", "dailyCarbs", "dailyFats", "dailyFiber", "dailyWaterMin", "dailySteps", "dailySleep"];
  const nutriFields = ["openaiApiKey", "openaiModel"];
  const optionFields = ["snackMorning", "preWorkout", "postWorkout", "afternoonSnack", "supper"];

  const fill = (form, state) => {
    fields.forEach((name) => {
      if (form.elements[name]) form.elements[name].value = state.profile[name] ?? "";
    });
    optionFields.forEach((name) => {
      if (form.elements[name]) form.elements[name].checked = Boolean(state.optionalMeals[name]);
    });
    if (form.elements.openaiApiKey) form.elements.openaiApiKey.value = state.nutriSettings?.apiKey || "";
    if (form.elements.openaiModel) form.elements.openaiModel.value = state.nutriSettings?.model || "gpt-5.5";
  };

  const read = (form) => {
    const profile = {};
    const optionalMeals = {};
    fields.forEach((name) => {
      profile[name] = HWPStorage.toNumber(form.elements[name].value);
    });
    optionFields.forEach((name) => {
      optionalMeals[name] = Boolean(form.elements[name].checked);
    });
    const nutriSettings = {};
    nutriFields.forEach((name) => {
      if (!form.elements[name]) return;
      if (name === "openaiApiKey") nutriSettings.apiKey = form.elements[name].value.trim();
      if (name === "openaiModel") nutriSettings.model = form.elements[name].value.trim() || "gpt-5.5";
    });
    return { profile, optionalMeals, nutriSettings };
  };

  window.HWPSettings = { fill, read };
})();
