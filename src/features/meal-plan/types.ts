import { z } from "zod";
import { isValidCalendarDateString } from "@/lib/validation";

export const calendarDate = z
  .string()
  .refine(isValidCalendarDateString, "올바른 날짜를 선택해 주세요.");
export const MEAL_STYLES = {
  AUTO: "자유 추천",
  SOUP: "스프류",
  ONE_BOWL: "한그릇 음식",
  RICE_SIDES: "밥 + 반찬",
} as const;
export const mealStyle = z.enum(["AUTO", "SOUP", "ONE_BOWL", "RICE_SIDES"]);
export type MealStyle = z.infer<typeof mealStyle>;
export const preferencesSchema = z.object({
  startDate: calendarDate,
  schedule: z.enum(["ALL", "WORKDAY", "CUSTOM"]).default("ALL"),
  meals: z
    .array(z.enum(["BREAKFAST", "LUNCH", "DINNER"]))
    .default(["BREAKFAST", "LUNCH", "DINNER"]),
  snackCount: z.number().int().min(0).max(2).default(1),
  selectedIngredientIds: z.array(z.string().uuid()).max(50).default([]),
  avoidedIngredientIds: z.array(z.string().uuid()).max(50).default([]),
  allowShopping: z.boolean().default(true),
  useStock: z.boolean().default(true),
  cookingMode: z.enum(["DAILY", "BATCH", "ANY"]).default("DAILY"),
  cookingInterval: z.number().int().min(1).max(3).default(1),
  cookingAnchor: calendarDate.optional(),
  repeatMeals: z.boolean().default(false),
  mealStyles: z
    .object({
      BREAKFAST: mealStyle.default("AUTO"),
      LUNCH: mealStyle.default("AUTO"),
      DINNER: mealStyle.default("AUTO"),
    })
    .default({ BREAKFAST: "AUTO", LUNCH: "AUTO", DINNER: "AUTO" }),
  sideCount: z.number().int().min(3).max(4).default(3),
  requireMeat: z.boolean().default(true),
  sidePortion: z.number().min(0.1).max(1).default(0.5),
  staplePortion: z.number().min(0.1).max(2).default(1),
  cookingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 3]),
  priorities: z
    .array(z.enum(["PANTRY", "EASY", "FAVORITE", "VARIETY"]))
    .max(2)
    .default(["EASY", "VARIETY"]),
  maxCookMinutes: z.number().int().min(5).max(120).default(30),
  tools: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type PlanPreferences = z.infer<typeof preferencesSchema>;
export type NutrientKey =
  "energy" | "protein" | "carbohydrate" | "fat" | "iron" | "calcium" | "sodium" | "fiber";
export const NUTRIENTS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: "energy", label: "열량", unit: "kcal" },
  { key: "protein", label: "단백질", unit: "g" },
  { key: "carbohydrate", label: "탄수화물", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
  { key: "iron", label: "철", unit: "mg" },
  { key: "calcium", label: "칼슘", unit: "mg" },
  { key: "sodium", label: "나트륨", unit: "mg" },
  { key: "fiber", label: "식이섬유", unit: "g" },
];
export interface NutritionEstimate {
  values: Record<NutrientKey, number | null>;
  coverage: Record<NutrientKey, number>;
  missing: string[];
  sources: { title: string; url: string }[];
}
export interface RecipeSnapshot {
  id: string;
  name: string;
  category: "MEAL" | "SNACK";
  role?: string;
  dishType?: "SOUP" | "ONE_BOWL" | "SIDE" | "STAPLE" | "SNACK" | "UNKNOWN";
  storage?: { fridgeDays: number | null; freezerDays: number | null };
  basicIds?: string[];
  ageStages?: number[];
  tools?: string[];
  manualBatchId?: string;
  manualConfirmed?: boolean;
  cookMinutes: number;
  baseServings: number;
  updatedAt: string;
  contentVersion: string;
  verified: boolean;
  groups: string[];
  ingredientIds: string[];
  ingredients: {
    id: string;
    name: string;
    amount: number | null;
    unit: string;
    optional: boolean;
  }[];
  nutrition: NutritionEstimate;
}
export interface PlannedEntry {
  date: string;
  mealTime: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  slotIndex: number;
  position: number;
  kind: "HOME" | "EXTERNAL" | "SKIPPED";
  recipeId: string | null;
  name: string;
  servings: number;
  locked: boolean;
  snapshot: RecipeSnapshot | Record<string, never>;
}
export interface EntryView extends PlannedEntry {
  id: string;
  served: boolean;
  reserved: number;
  needsAttention: boolean;
}
export interface TaskView {
  id: string;
  recipeId: string;
  date: string;
  servings: number;
  name: string;
  completed: boolean;
  needed: number;
  requiredThrough: string;
  ingredients: RecipeSnapshot["ingredients"];
  baseServings: number;
}
export interface PlanView {
  id: string;
  startDate: string;
  status: string;
  revision: number;
  preferences: PlanPreferences;
  entries: EntryView[];
  tasks: TaskView[];
}
export interface StockView {
  id: string;
  recipeId: string | null;
  name: string;
  category: "MEAL" | "SNACK";
  location: string;
  preparedDate: string;
  expiresDate: string | null;
  remaining: number;
  reserved: number;
  available: number;
  usable: boolean;
  version: number;
}
export interface PlannerData {
  savedPreferences?: PlanPreferences;
  plans: PlanView[];
  stock: StockView[];
  recipes: RecipeSnapshot[];
  ingredients: { id: string; name: string; group: string }[];
  pantryIds: string[];
}
