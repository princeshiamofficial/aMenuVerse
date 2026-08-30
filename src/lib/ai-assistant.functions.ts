"use server";

import { createServerFn } from "./server-fn";
import { z } from "zod";

const InputSchema = z.object({
  task: z.enum([
    "translate",
    "improve_image_prompt",
    "suggest_price",
    "suggest_combo",
    "suggest_upsell",
    "sales_insight",
    "customer_recommendation",
    "seasonal_menu",
  ]),
  input: z.string().min(1).max(4000),
  extra: z.string().max(200).optional(),
});

const PROMPTS: Record<
  z.infer<typeof InputSchema>["task"],
  (input: string, extra?: string) => { system: string; user: string }
> = {
  translate: (input, extra) => ({
    system: `You are a professional culinary translator. Translate menu items faithfully, preserving culinary nuance.`,
    user: `Translate the following menu content to ${extra || "Spanish"}. Return ONLY the translation, preserving line breaks:\n\n${input}`,
  }),
  improve_image_prompt: (input) => ({
    system:
      "You are a food photography director. Given a dish name or a rough description, produce ONE detailed image-generation prompt (2-3 sentences) describing lighting, angle, plating, garnish, background, and mood for a premium menu photo.",
    user: `Dish: ${input}`,
  }),
  suggest_price: (input) => ({
    system:
      "You are a restaurant pricing consultant. Given a dish (ingredients, portion, positioning), suggest a price range in USD with a short rationale. Format:\n\nSuggested: $X.XX\nRange: $X - $X\nRationale: ...",
    user: input,
  }),
  suggest_combo: (input) => ({
    system:
      "You are a menu strategist. Given a list of menu items, propose 3 combo meals (name, items included, suggested price, why it works). Use short markdown.",
    user: `Menu items:\n${input}`,
  }),
  suggest_upsell: (input) => ({
    system:
      "You are an upselling expert. Given a base item or order, suggest 3 upsell add-ons (sides, drinks, desserts, upgrades) with a one-line pitch each.",
    user: input,
  }),
  sales_insight: (input) => ({
    system:
      "You are a restaurant analytics advisor. Given sales data or a description, produce 3-5 actionable insights and recommendations. Use bullet points.",
    user: input,
  }),
  customer_recommendation: (input) => ({
    system:
      "You are a friendly waiter AI. Given customer preferences or past orders, recommend 3 dishes with a short reason each.",
    user: input,
  }),
  seasonal_menu: (input, extra) => ({
    system:
      "You are a chef. Propose a seasonal menu (5-7 items) with dish name and a one-line description. Group by course if relevant.",
    user: `Season/theme: ${extra || "current season"}\nCuisine/restaurant context: ${input}`,
  }),
};

export const runAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const taskHandler = PROMPTS[data.task as keyof typeof PROMPTS];
    if (!taskHandler) throw new Error(`Unknown task: ${data.task}`);
    const { system, user } = taskHandler(data.input, data.extra);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits to your workspace.");
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { text: content };
  });
