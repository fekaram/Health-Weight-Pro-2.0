(function () {
  "use strict";

  const ENDPOINT = "https://api.openai.com/v1/responses";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      foods: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            quantity: { type: "string" },
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            fiber: { type: "number" }
          },
          required: ["name", "quantity", "calories", "protein", "carbs", "fat", "fiber"]
        }
      },
      totals: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fiber: { type: "number" }
        },
        required: ["calories", "protein", "carbs", "fat", "fiber"]
      }
    },
    required: ["foods", "totals"]
  };

  const prompt = (text) => `
Voce e um nutricionista brasileiro especializado em estimativa nutricional pratica.
Analise a refeicao enviada por texto e/ou imagem.
Objetivo:
- Identificar alimentos.
- Estimar porcoes em gramas, unidades ou medidas caseiras.
- Calcular calorias, proteinas, carboidratos, gorduras e fibras.
- Retornar somente JSON valido no schema solicitado.

Regras:
- Use valores aproximados realistas.
- Se houver incerteza, estime de forma conservadora e explicite a porcao em "quantity".
- Nao inclua texto fora do JSON.
- Campos numericos devem ser numeros.

Descricao do usuario:
${text || "Sem descricao textual. Use a imagem como fonte principal."}
`.trim();

  const readOutputText = (data) => {
    if (typeof data.output_text === "string") return data.output_text;
    const content = data.output?.flatMap((item) => item.content || []) || [];
    const textItem = content.find((item) => typeof item.text === "string");
    return textItem?.text || "";
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeResult = (result) => {
    const foods = Array.isArray(result.foods) ? result.foods : [];
    const normalizedFoods = foods.map((food) => ({
      name: String(food.name || "Alimento").trim(),
      quantity: String(food.quantity || "").trim(),
      calories: Math.round(toNumber(food.calories)),
      protein: toNumber(food.protein),
      carbs: toNumber(food.carbs),
      fat: toNumber(food.fat),
      fiber: toNumber(food.fiber)
    }));
    const totals = result.totals || {};
    const sum = (field) => normalizedFoods.reduce((total, food) => total + toNumber(food[field]), 0);
    return {
      foods: normalizedFoods,
      totals: {
        calories: Math.round(toNumber(totals.calories) || sum("calories")),
        protein: toNumber(totals.protein) || sum("protein"),
        carbs: toNumber(totals.carbs) || sum("carbs"),
        fat: toNumber(totals.fat) || sum("fat"),
        fiber: toNumber(totals.fiber) || sum("fiber")
      }
    };
  };

  const analyze = async ({ apiKey, model, text, imageDataUrl }) => {
    if (!apiKey) throw new Error("Informe sua chave da OpenAI em Ajustes.");
    if (!text && !imageDataUrl) throw new Error("Envie uma foto ou descreva a refeicao.");

    const content = [{ type: "input_text", text: prompt(text) }];
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "gpt-5.5",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_analysis",
            strict: true,
            schema
          }
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error?.message || "Falha ao analisar refeicao.";
      throw new Error(message);
    }

    const outputText = readOutputText(payload);
    if (!outputText) throw new Error("A resposta da IA veio vazia.");

    try {
      return normalizeResult(JSON.parse(outputText));
    } catch (error) {
      console.warn("Resposta Nutri IA invalida.", outputText, error);
      throw new Error("A IA nao retornou JSON valido. Tente novamente com uma descricao mais especifica.");
    }
  };

  window.HWPNutriAI = { analyze };
})();
