import profiles from "@/data/recipe-meal-profiles.json";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { BabyProfileView } from "@/features/profile";
import {
  allowedSaltLevelsForBaby,
  isRecipeSafeForBaby,
  loadIngredientDictionaryMap,
} from "@/features/recipe";
import { currentAgeMonth, getAgeStage, kstDateString } from "@/lib/age";
import { getPrisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { addDays, aggregateNutrition, cookingDate, generateWeek } from "./engine";
import { estimateRecipeNutrition } from "./nutrition";
import {
  calendarDate,
  preferencesSchema,
  type EntryView,
  type PlannerData,
  type PlanPreferences,
  type PlanView,
  type RecipeSnapshot,
  type StockView,
} from "./types";

type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const amount = (n: number) => Math.round(n * 10000) / 10000;
const day = (value: Date) => value.toISOString().slice(0, 10);
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const conflict = () =>
  new AppError(409, "PLAN_CHANGED", "다른 곳에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.");

async function serialized<T>(
  userId: string,
  work: (tx: Tx) => Promise<T>,
  prisma = getPrisma(),
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // A household row lock serializes reservations across babies, plans and concurrent requests.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      await tx.foodReservation.deleteMany({
        where: { batch: { userId, expiresDate: { lt: date(kstDateString(new Date())) } } },
      });
      return work(tx);
    },
    { timeout: 30_000 },
  );
}

export async function loadRecipeCatalog(
  baby: BabyProfileView,
  prisma: PrismaClient | Tx = getPrisma(),
): Promise<RecipeSnapshot[]> {
  const [recipes, dict] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        status: "ACTIVE",
        saltLevel: { in: allowedSaltLevelsForBaby(baby.saltLevel) },
        ageStages: { has: baby.ageStage },
      },
      include: { ingredients: { include: { ingredient: true } }, sources: true },
      orderBy: { name: "asc" },
    }),
    loadIngredientDictionaryMap(prisma as PrismaClient),
  ]);
  return recipes
    .filter((r) => isRecipeSafeForBaby(r.ingredients, dict, baby))
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      role: r.mealRole,
      dishType: ((profiles as Record<string, string>)[r.slug ?? r.id] ??
        "UNKNOWN") as RecipeSnapshot["dishType"],
      storage: r.storageInfo as RecipeSnapshot["storage"],
      basicIds: r.ingredients.filter((i) => i.ingredient.isPantryBasic).map((i) => i.ingredientId),
      ageStages: r.ageStages,
      tools: r.tools,
      baseServings: r.baseServings,
      cookMinutes: r.cookMinutes,
      updatedAt: r.updatedAt.toISOString(),
      verified: r.sources.some((s) => s.verificationStatus === "VERIFIED"),
      contentVersion: createHash("sha256")
        .update(
          JSON.stringify({
            ingredients: r.ingredients.map((i) => ({
              id: i.ingredientId,
              amount: i.amount,
              unit: i.unit,
              optional: i.isOptional,
              nutrition: i.ingredient.nutrition,
            })),
            steps: r.steps,
            ages: r.ageStages,
            salt: r.saltLevel,
            base: r.baseServings,
          }),
        )
        .digest("hex"),
      groups: [
        ...new Set(r.ingredients.filter((i) => !i.isOptional).map((i) => i.ingredient.group)),
      ],
      ingredientIds: r.ingredients.map((i) => i.ingredientId),
      ingredients: r.ingredients.map((i) => ({
        id: i.ingredientId,
        name: i.ingredient.name,
        amount: i.amount,
        unit: i.unit,
        optional: i.isOptional,
      })),
      nutrition: estimateRecipeNutrition(r.baseServings, r.ingredients),
    }));
}

async function stockViews(
  userId: string,
  catalog: RecipeSnapshot[],
  prisma: PrismaClient | Tx,
): Promise<StockView[]> {
  const rows = await prisma.foodBatch.findMany({
    where: { userId, remaining: { gt: 0 } },
    include: { reservations: true },
    orderBy: [{ expiresDate: "asc" }, { createdAt: "asc" }],
  });
  const today = kstDateString(new Date());
  return rows.map((b) => {
    const snapshot = b.snapshot as unknown as RecipeSnapshot;
    const current = catalog.find((r) => r.id === b.recipeId);
    const usable =
      !!current &&
      current.contentVersion === snapshot.contentVersion &&
      !!b.expiresDate &&
      day(b.expiresDate) >= today;
    const reserved = amount(b.reservations.reduce((sum, r) => sum + r.servings, 0));
    return {
      id: b.id,
      recipeId: b.recipeId,
      name: b.name,
      category: b.category,
      location: b.location,
      preparedDate: day(b.preparedDate),
      expiresDate: b.expiresDate ? day(b.expiresDate) : null,
      remaining: amount(b.remaining),
      reserved,
      available: usable ? Math.max(0, amount(b.remaining - reserved)) : 0,
      usable,
      version: b.version,
    };
  });
}

export async function getPlannerData(
  userId: string,
  baby: BabyProfileView,
  prisma = getPrisma(),
): Promise<PlannerData> {
  const recipes = await loadRecipeCatalog(baby, prisma);
  const [stock, plans, pantry, ingredients, saved] = await Promise.all([
    stockViews(userId, recipes, prisma),
    prisma.mealPlan.findMany({
      where: { userId, babyId: baby.id, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        entries: {
          include: { reservations: { include: { batch: true } } },
          orderBy: [
            { date: "asc" },
            { mealTime: "asc" },
            { slotIndex: "asc" },
            { position: "asc" },
          ],
        },
        tasks: { orderBy: { date: "asc" } },
      },
    }),
    prisma.pantryItem.findMany({ where: { userId } }),
    prisma.ingredient.findMany({
      where: { minAgeMonth: { lte: baby.currentAgeMonth } },
      select: { id: true, name: true, group: true },
      orderBy: { name: "asc" },
    }),
    prisma.mealPlan.findFirst({
      where: { userId, babyId: baby.id },
      orderBy: { createdAt: "desc" },
      select: { preferences: true },
    }),
  ]);
  const safeIds = new Set(recipes.map((r) => r.id));
  const views: PlanView[] = plans.map((p) => {
    const entries: EntryView[] = p.entries.map((e) => ({
      ...e,
      date: day(e.date),
      kind: e.kind as EntryView["kind"],
      snapshot: e.snapshot as unknown as RecipeSnapshot,
      reserved: e.reservations
        .filter(
          (r) =>
            r.batch.expiresDate &&
            day(r.batch.expiresDate) >= day(e.date) &&
            (safeIds.has(r.batch.recipeId ?? "") ||
              (e.snapshot as unknown as RecipeSnapshot).manualBatchId === r.batchId),
        )
        .reduce((sum, r) => sum + r.servings, 0),
      needsAttention:
        !e.served &&
        e.kind === "HOME" &&
        ((!(e.snapshot as unknown as RecipeSnapshot).manualBatchId && !e.recipeId) ||
          ((e.snapshot as unknown as RecipeSnapshot).manualBatchId
            ? !stock.some(
                (b) =>
                  b.id === (e.snapshot as unknown as RecipeSnapshot).manualBatchId &&
                  b.expiresDate &&
                  b.expiresDate >= day(e.date),
              )
            : !safeIds.has(e.recipeId ?? "") ||
              (e.snapshot as unknown as RecipeSnapshot).contentVersion !==
                recipes.find((r) => r.id === e.recipeId)?.contentVersion)),
    }));
    return {
      id: p.id,
      startDate: day(p.startDate),
      status: p.status,
      revision: p.revision,
      preferences: preferencesSchema.parse(p.preferences),
      entries,
      tasks: p.tasks.map((t, taskIndex) => {
        const snap = t.snapshot as unknown as RecipeSnapshot;
        const related = entries.filter(
          (e) =>
            e.recipeId === t.recipeId &&
            cookingDate(preferencesSchema.parse(p.preferences), e.date) === day(t.date) &&
            e.kind === "HOME" &&
            !e.served,
        );
        return {
          id: t.id,
          recipeId: t.recipeId,
          name: snap.name,
          date: day(t.date),
          servings: t.servings,
          completed: t.completed,
          needed: amount(
            Math.min(
              5,
              Math.max(
                0,
                related.reduce((sum, e) => sum + e.servings - e.reserved, 0) -
                  5 *
                    p.tasks
                      .slice(0, taskIndex)
                      .filter(
                        (other) =>
                          !other.completed &&
                          other.recipeId === t.recipeId &&
                          day(other.date) === day(t.date),
                      ).length,
              ),
            ),
          ),
          requiredThrough:
            related
              .map((e) => e.date)
              .sort()
              .at(-1) ?? day(t.date),
          ingredients: snap.ingredients,
          baseServings: snap.baseServings,
        };
      }),
    };
  });
  // Ingredient choices apply the same allergy filter as recipes, including direct ingredient exclusions.
  const dict = await loadIngredientDictionaryMap(prisma);
  const safeIngredients = ingredients.filter((i) =>
    isRecipeSafeForBaby([{ ingredientId: i.id }], dict, baby),
  );
  return {
    plans: views,
    stock,
    recipes,
    ingredients: safeIngredients,
    pantryIds: pantry.map((p) => p.ingredientId),
    savedPreferences: saved ? preferencesSchema.parse(saved.preferences) : undefined,
  };
}

async function rebuildTasks(
  tx: Tx,
  planId: string,
  prefs: PlanPreferences,
  entries: {
    recipeId: string | null;
    date: Date;
    servings: number;
    kind: string;
    served: boolean;
    snapshot: unknown;
    reservations?: { servings: number }[];
  }[],
) {
  const previous = await tx.cookingTask.findMany({ where: { planId, completed: false } });
  await tx.cookingTask.deleteMany({ where: { planId, completed: false } });
  const buckets = new Map<
    string,
    { recipeId: string; date: string; needed: number; snapshot: unknown }
  >();
  for (const e of entries) {
    if (!e.recipeId || e.kind !== "HOME" || e.served) continue;
    const count = e.servings - (e.reservations ?? []).reduce((sum, r) => sum + r.servings, 0);
    if (count <= 0) continue;
    const cookDay = cookingDate(prefs, day(e.date));
    const key = `${e.recipeId}:${cookDay}`;
    const value = buckets.get(key) ?? {
      recipeId: e.recipeId,
      date: cookDay,
      needed: 0,
      snapshot: e.snapshot,
    };
    value.needed = amount(value.needed + count);
    buckets.set(key, value);
  }
  for (const b of buckets.values()) {
    const old = previous
      .filter((t) => t.recipeId === b.recipeId && day(t.date) === b.date)
      .reduce((sum, t) => sum + t.servings, 0);
    let remaining = amount(Math.max(b.needed, old));
    while (remaining > 0) {
      const servings = Math.min(5, remaining);
      await tx.cookingTask.create({
        data: {
          planId,
          recipeId: b.recipeId,
          date: date(b.date),
          servings,
          snapshot: json(b.snapshot),
        },
      });
      remaining = amount(remaining - servings);
    }
  }
}

async function allocateStock(
  tx: Tx,
  userId: string,
  planId: string,
  catalog: RecipeSnapshot[],
  useStock: boolean,
) {
  const entries = await tx.mealPlanEntry.findMany({
    where: { planId, kind: "HOME", served: false },
    orderBy: { date: "asc" },
  });
  await tx.foodReservation.deleteMany({ where: { entry: { planId, served: false } } });
  const stock = await stockViews(userId, catalog, tx);
  for (const entry of entries) {
    let need = entry.servings;
    const explicitBatch = (entry.snapshot as unknown as RecipeSnapshot).manualBatchId;
    for (const b of stock) {
      const direct = explicitBatch === b.id;
      const free = direct ? b.remaining - b.reserved : b.available;
      if (
        (explicitBatch ? !direct : !useStock || b.recipeId !== entry.recipeId || !b.usable) ||
        free <= 0 ||
        b.preparedDate > day(entry.date) ||
        !b.expiresDate ||
        b.expiresDate < day(entry.date)
      )
        continue;
      const servings = Math.min(need, free);
      await tx.foodReservation.create({ data: { batchId: b.id, entryId: entry.id, servings } });
      b.reserved += servings;
      b.available = b.usable ? Math.max(0, b.remaining - b.reserved) : 0;
      need = amount(need - servings);
      if (!need) break;
    }
    if (need > 0 && explicitBatch)
      throw new AppError(
        409,
        "STOCK_SHORT",
        "직접 담은 음식의 사용 가능한 재고가 부족해요. 메뉴를 조정해 주세요.",
      );
  }
}

export async function createPlan(
  userId: string,
  baby: BabyProfileView,
  input: unknown,
  prisma = getPrisma(),
) {
  const prefs = preferencesSchema.parse(input);
  if (prefs.cookingInterval > 1 && !prefs.cookingAnchor) prefs.cookingAnchor = prefs.startDate;
  if (prefs.cookingAnchor && prefs.cookingAnchor > prefs.startDate)
    throw new AppError(400, "ANCHOR_DATE", "조리 기준일은 시작일 이전으로 골라 주세요.");
  const today = kstDateString(new Date());
  if (prefs.startDate < today || prefs.startDate > addDays(today, 90))
    throw new AppError(400, "PLAN_DATE", "시작일은 오늘부터 90일 이내로 선택해 주세요.");
  const catalog = await loadRecipeCatalog(baby, prisma);
  const endAge = currentAgeMonth(
    baby.ageMonthAtInput,
    date(baby.ageInputDate),
    new Date(`${addDays(prefs.startDate, 6)}T12:00:00Z`),
  );
  // Only auto-place recipes also appropriate at the end of this plan's age window.
  const endRows = await prisma.recipe.findMany({
    where: {
      id: { in: catalog.map((r) => r.id) },
      ageStages: { has: getAgeStage(Math.min(48, endAge)) },
    },
    select: { id: true },
  });
  const ids = new Set(endRows.map((r) => r.id));
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { recipeId: true },
  });
  const recent = await prisma.mealLog.findMany({
    where: { babyId: baby.id, eatenAt: { gte: new Date(Date.now() - 3 * 86400000) } },
    select: { recipeId: true },
  });
  const stock = await stockViews(userId, catalog, prisma);
  const entries = generateWeek(
    prefs,
    catalog.filter((r) => ids.has(r.id)),
    {
      favorites: new Set(favorites.map((f) => f.recipeId)),
      recent: new Set(recent.map((f) => f.recipeId)),
      stock: stock.filter((b) => b.usable),
      ageMonth: endAge,
    },
  );
  return serialized(
    userId,
    async (tx) => {
      const plan = await tx.mealPlan.create({
        data: {
          userId,
          babyId: baby.id,
          startDate: date(prefs.startDate),
          preferences: json(prefs),
          entries: {
            create: entries.map((e) => ({ ...e, date: date(e.date), snapshot: json(e.snapshot) })),
          },
        },
      });
      const rows = await tx.mealPlanEntry.findMany({ where: { planId: plan.id } });
      await rebuildTasks(tx, plan.id, prefs, rows);
      return { id: plan.id };
    },
    prisma,
  );
}

const planActionSchema = z.object({
  action: z.enum([
    "CONFIRM",
    "EDIT",
    "ARCHIVE",
    "ENTRY",
    "ADD",
    "REGENERATE",
    "MEAL_REGENERATE",
    "TASK",
    "COOK",
    "SERVE",
    "SERVE_MEAL",
    "STOCK",
  ]),
  revision: z.number().int().min(0),
  entryId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  confirmedIngredients: z.boolean().optional(),
  recipeId: z.string().uuid().optional(),
  date: calendarDate.optional(),
  mealTime: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).optional(),
  slotIndex: z.number().int().min(0).max(1).optional(),
  servings: z.number().min(0.1).max(5).optional(),
  locked: z.boolean().optional(),
  kind: z.enum(["HOME", "EXTERNAL", "SKIPPED"]).optional(),
  location: z.enum(["FRIDGE", "FREEZER"]).optional(),
  expiresDate: calendarDate.optional(),
  amounts: z
    .array(
      z.object({
        entryId: z.string().uuid(),
        rating: z.enum(["GOOD", "OK", "REFUSED"]).default("OK"),
        amountEaten: z.enum(["ALL", "HALF", "LITTLE"]).optional(),
      }),
    )
    .max(8)
    .optional(),
  rating: z.enum(["GOOD", "OK", "REFUSED"]).default("OK"),
  amountEaten: z.enum(["ALL", "HALF", "LITTLE"]).optional(),
});

export async function changePlan(
  userId: string,
  baby: BabyProfileView,
  planId: string,
  raw: unknown,
  prisma = getPrisma(),
) {
  const input = planActionSchema.parse(raw);
  const catalog = await loadRecipeCatalog(baby, prisma);
  return serialized(
    userId,
    async (tx) => {
      const plan = await tx.mealPlan.findFirst({
        where: { id: planId, userId, babyId: baby.id, status: { not: "ARCHIVED" } },
        include: {
          entries: { include: { reservations: { include: { batch: true } } } },
          tasks: true,
        },
      });
      if (!plan) throw new AppError(404, "PLAN_NOT_FOUND", "식단을 찾을 수 없습니다.");
      // Completed events are idempotent even when the caller retries with the previous revision.
      if (input.action === "COOK" && plan.tasks.find((t) => t.id === input.taskId)?.completed)
        return { id: planId };
      if (input.action === "SERVE" && plan.entries.find((e) => e.id === input.entryId)?.served)
        return { id: planId };
      if (input.action === "SERVE_MEAL") {
        const group = plan.entries.filter(
          (e) =>
            day(e.date) === kstDateString(new Date()) &&
            e.mealTime === input.mealTime &&
            e.slotIndex === (input.slotIndex ?? 0) &&
            e.kind === "HOME",
        );
        if (group.length && group.every((e) => e.served)) return { id: planId };
      }
      if (plan.revision !== input.revision) throw conflict();
      const prefs = preferencesSchema.parse(plan.preferences);
      const today = kstDateString(new Date());
      const entry = plan.entries.find((e) => e.id === input.entryId);
      const recipe = catalog.find((r) => r.id === input.recipeId);
      const assertDraft = () => {
        if (plan.status !== "DRAFT")
          throw new AppError(409, "PLAN_CONFIRMED", "먼저 ‘식단 수정’을 눌러 주세요.");
      };
      const validAtDate = (r: RecipeSnapshot, d: Date) =>
        r.ageStages?.includes(
          getAgeStage(
            Math.min(
              48,
              currentAgeMonth(
                baby.ageMonthAtInput,
                date(baby.ageInputDate),
                new Date(`${day(d)}T12:00:00Z`),
              ),
            ),
          ) ?? -1,
        ) ?? false;
      const manualBatches = await tx.foodBatch.findMany({
        where: {
          userId,
          id: {
            in: plan.entries
              .map((e) => (e.snapshot as unknown as RecipeSnapshot).manualBatchId)
              .filter((id): id is string => !!id),
          },
        },
      });
      const safeEntry = (e: (typeof plan.entries)[number]) => {
        const snap = e.snapshot as unknown as RecipeSnapshot;
        if (snap.manualBatchId) {
          const batch = manualBatches.find((b) => b.id === snap.manualBatchId);
          if (
            !snap.manualConfirmed ||
            !batch ||
            !batch.expiresDate ||
            day(batch.preparedDate) > day(e.date) ||
            day(batch.expiresDate) < day(e.date)
          )
            return false;
          if (!e.recipeId) return true;
        }
        return catalog.some(
          (r) =>
            r.id === e.recipeId &&
            validAtDate(r, e.date) &&
            r.contentVersion === (e.snapshot as unknown as RecipeSnapshot).contentVersion,
        );
      };
      if (input.action === "ARCHIVE" || input.action === "EDIT") {
        await tx.foodReservation.deleteMany({ where: { entry: { planId, served: false } } });
        await tx.mealPlan.update({
          where: { id: planId },
          data: { status: input.action === "ARCHIVE" ? "ARCHIVED" : "DRAFT" },
        });
      } else if (input.action === "CONFIRM") {
        assertDraft();
        if (plan.entries.some((e) => e.kind === "HOME" && !e.served && !safeEntry(e)))
          throw new AppError(
            400,
            "INCOMPLETE_PLAN",
            "빈 메뉴나 변경된 레시피를 먼저 확인해 주세요.",
          );
        const overlap = await tx.mealPlanEntry.findFirst({
          where: {
            plan: { userId, babyId: baby.id, status: "CONFIRMED", id: { not: planId } },
            OR: plan.entries
              .filter((e) => e.kind === "HOME")
              .map((e) => ({ date: e.date, mealTime: e.mealTime, slotIndex: e.slotIndex })),
          },
        });
        if (overlap)
          throw new AppError(
            409,
            "PLAN_OVERLAP",
            "같은 날짜·끼니의 확정 식단이 있습니다. 기존 식단을 수정하거나 보관해 주세요.",
          );
        await allocateStock(tx, userId, planId, catalog, prefs.useStock);
        await tx.mealPlan.update({ where: { id: planId }, data: { status: "CONFIRMED" } });
      } else if (["REGENERATE", "MEAL_REGENERATE"].includes(input.action)) {
        assertDraft();
        const [favorites, recent, stock] = await Promise.all([
          tx.favorite.findMany({ where: { userId }, select: { recipeId: true } }),
          tx.mealLog.findMany({
            where: { babyId: baby.id, eatenAt: { gte: new Date(Date.now() - 3 * 86400000) } },
            select: { recipeId: true },
          }),
          stockViews(userId, catalog, tx),
        ]);
        const next = generateWeek(
          prefs,
          catalog.filter((r) => validAtDate(r, date(addDays(prefs.startDate, 6)))),
          {
            seed: plan.revision + 1,
            fixedEntries: plan.entries
              .filter((e) => e.locked || e.served)
              .map((e) => ({
                ...e,
                date: day(e.date),
                kind: e.kind as EntryView["kind"],
                snapshot: e.snapshot as unknown as RecipeSnapshot,
              })),
            replacing: plan.entries.map((e) => ({
              ...e,
              date: day(e.date),
              kind: e.kind as EntryView["kind"],
              snapshot: e.snapshot as unknown as RecipeSnapshot,
            })),
            favorites: new Set(favorites.map((f) => f.recipeId)),
            recent: new Set(recent.map((f) => f.recipeId)),
            stock: stock.filter((s) => s.usable),
            ageMonth: baby.currentAgeMonth,
          },
        );
        for (const e of plan.entries.filter(
          (e) =>
            !e.locked &&
            !e.served &&
            (input.action !== "MEAL_REGENERATE" ||
              (day(e.date) === input.date &&
                e.mealTime === input.mealTime &&
                e.slotIndex === (input.slotIndex ?? 0))),
        )) {
          const replacement = next.find(
            (n) =>
              n.date === day(e.date) &&
              n.mealTime === e.mealTime &&
              n.slotIndex === e.slotIndex &&
              n.position === e.position,
          );
          if (replacement)
            await tx.mealPlanEntry.update({
              where: { id: e.id },
              data: {
                ...replacement,
                date: date(replacement.date),
                snapshot: json(replacement.snapshot),
              },
            });
        }
      } else if (input.action === "STOCK") {
        assertDraft();
        const batch = await tx.foodBatch.findFirst({
          where: {
            id: input.batchId ?? "00000000-0000-0000-0000-000000000000",
            userId,
            remaining: { gt: 0 },
          },
        });
        const target = input.date ?? prefs.startDate;
        if (
          !batch ||
          !input.confirmedIngredients ||
          !input.mealTime ||
          !batch.expiresDate ||
          day(batch.expiresDate) < target ||
          day(batch.preparedDate) > target ||
          target < today ||
          target < prefs.startDate ||
          target > addDays(prefs.startDate, 6)
        )
          throw new AppError(
            400,
            "STOCK_CONFIRM",
            "사용할 음식의 재료·기한과 식사 날짜를 확인해 주세요.",
          );
        const linked = batch.recipeId ? catalog.find((r) => r.id === batch.recipeId) : null;
        if (batch.recipeId && (!linked || !validAtDate(linked, date(target))))
          throw new AppError(
            400,
            "RECIPE_UNAVAILABLE",
            "이 음식의 레시피가 현재 아기 조건에 맞지 않습니다.",
          );
        const placeholder = plan.entries.find(
          (e) =>
            day(e.date) === target &&
            e.mealTime === input.mealTime &&
            e.slotIndex === (input.slotIndex ?? 0) &&
            !e.recipeId &&
            !(e.snapshot as unknown as RecipeSnapshot).manualBatchId,
        );
        if (placeholder) await tx.mealPlanEntry.delete({ where: { id: placeholder.id } });
        const snap = {
          ...(linked ?? {
            id: batch.id,
            name: batch.name,
            category: batch.category,
            cookMinutes: 0,
            baseServings: 1,
            verified: false,
            updatedAt: "manual",
            contentVersion: "manual",
            groups: [],
            ingredientIds: [],
            ingredients: [],
            nutrition: { ...aggregateNutrition([]), missing: [batch.name] },
          }),
          manualBatchId: batch.id,
          manualConfirmed: true,
        };
        await tx.mealPlanEntry.create({
          data: {
            planId,
            date: date(target),
            mealTime: input.mealTime,
            slotIndex: input.slotIndex ?? 0,
            position:
              Math.max(
                -1,
                ...plan.entries
                  .filter(
                    (e) =>
                      day(e.date) === target &&
                      e.mealTime === input.mealTime &&
                      e.slotIndex === (input.slotIndex ?? 0),
                  )
                  .map((e) => e.position),
              ) + 1,
            recipeId: linked?.id,
            name: batch.name,
            servings: input.servings ?? 1,
            locked: true,
            snapshot: json(snap),
          },
        });
      } else if (input.action === "ENTRY" || input.action === "ADD") {
        assertDraft();
        if (input.action === "ENTRY" && !entry)
          throw new AppError(404, "ENTRY_NOT_FOUND", "메뉴를 찾을 수 없습니다.");
        if (entry?.served)
          throw new AppError(409, "ALREADY_SERVED", "이미 제공한 메뉴는 기록에서 확인해 주세요.");
        if (input.recipeId && !recipe)
          throw new AppError(400, "RECIPE_UNAVAILABLE", "현재 아기 조건에 맞지 않는 레시피입니다.");
        const targetDate = input.date ?? (entry ? day(entry.date) : prefs.startDate);
        if (
          targetDate < prefs.startDate ||
          targetDate > addDays(prefs.startDate, 6) ||
          targetDate < today
        )
          throw new AppError(400, "ENTRY_DATE", "계획 기간 안의 오늘 이후 날짜를 선택해 주세요.");
        if (recipe && !validAtDate(recipe, date(targetDate)))
          throw new AppError(400, "RECIPE_AGE", "선택한 날짜의 월령에 맞는 레시피를 골라 주세요.");
        const data = {
          ...(recipe
            ? { recipeId: recipe.id, name: recipe.name, kind: "HOME", snapshot: json(recipe) }
            : {}),
          ...(input.kind ? { kind: input.kind } : {}),
          ...(input.servings ? { servings: input.servings } : {}),
          ...(input.locked !== undefined ? { locked: input.locked } : {}),
          date: date(targetDate),
          ...(input.mealTime ? { mealTime: input.mealTime } : {}),
        };
        if (entry) {
          const moved =
            targetDate !== day(entry.date) || (input.mealTime && input.mealTime !== entry.mealTime);
          const position = moved
            ? Math.max(
                -1,
                ...plan.entries
                  .filter(
                    (e) =>
                      e.id !== entry.id &&
                      day(e.date) === targetDate &&
                      e.mealTime === (input.mealTime ?? entry.mealTime) &&
                      e.slotIndex === entry.slotIndex,
                  )
                  .map((e) => e.position),
              ) + 1
            : entry.position;
          await tx.mealPlanEntry.update({ where: { id: entry.id }, data: { ...data, position } });
        } else {
          if (!recipe || !input.mealTime)
            throw new AppError(400, "RECIPE_REQUIRED", "추가할 메뉴와 끼니를 선택해 주세요.");
          const slotIndex = input.slotIndex ?? 0;
          const placeholder = plan.entries.find(
            (e) =>
              day(e.date) === targetDate &&
              e.mealTime === input.mealTime &&
              e.slotIndex === slotIndex &&
              !e.recipeId &&
              !e.served,
          );
          if (placeholder) await tx.mealPlanEntry.delete({ where: { id: placeholder.id } });
          const position =
            Math.max(
              -1,
              ...plan.entries
                .filter(
                  (e) =>
                    day(e.date) === targetDate &&
                    e.mealTime === input.mealTime &&
                    e.slotIndex === slotIndex,
                )
                .map((e) => e.position),
            ) + 1;
          await tx.mealPlanEntry.create({
            data: {
              planId,
              recipeId: recipe.id,
              name: recipe.name,
              mealTime: input.mealTime,
              slotIndex,
              position,
              date: date(targetDate),
              servings: input.servings ?? 1,
              snapshot: json(recipe),
            },
          });
        }
      } else if (input.action === "TASK") {
        const task = plan.tasks.find((t) => t.id === input.taskId && !t.completed);
        if (!task || !input.servings)
          throw new AppError(400, "TASK_UNAVAILABLE", "조리할 음식을 확인해 주세요.");
        await tx.cookingTask.update({ where: { id: task.id }, data: { servings: input.servings } });
      } else if (input.action === "COOK") {
        if (plan.status !== "CONFIRMED")
          throw new AppError(400, "CONFIRM_FIRST", "식단을 먼저 확정해 주세요.");
        const task = plan.tasks.find((t) => t.id === input.taskId);
        if (
          !task ||
          !catalog.some(
            (r) =>
              r.id === task.recipeId &&
              r.contentVersion === (task.snapshot as unknown as RecipeSnapshot).contentVersion,
          )
        )
          throw new AppError(400, "TASK_UNAVAILABLE", "변경된 레시피와 아기 조건을 확인해 주세요.");
        if (day(task.date) > today)
          throw new AppError(400, "FUTURE_COOK", "아직 조리일이 되지 않았습니다.");
        if (!input.expiresDate || input.expiresDate < today || !input.location)
          throw new AppError(
            400,
            "STORAGE_REQUIRED",
            "보관 장소와 직접 확인한 사용 기한을 선택해 주세요.",
          );
        const snap = task.snapshot as unknown as RecipeSnapshot;
        const batch = await tx.foodBatch.create({
          data: {
            userId,
            recipeId: task.recipeId,
            taskId: task.id,
            name: snap.name,
            category: snap.category,
            location: input.location,
            preparedDate: date(today),
            expiresDate: date(input.expiresDate),
            remaining: input.servings ?? task.servings,
            snapshot: json(snap),
            movements: {
              create: {
                kind: "COOK",
                delta: input.servings ?? task.servings,
                eventKey: `cook:${task.id}`,
              },
            },
          },
        });
        await tx.cookingTask.update({ where: { id: task.id }, data: { completed: true } });
        // Keep existing allocations; allocate only the newly cooked quantity to this plan.
        let available = batch.remaining;
        for (const e of [...plan.entries].sort((a, b) => a.date.getTime() - b.date.getTime())) {
          if (
            e.recipeId !== task.recipeId ||
            e.served ||
            e.kind !== "HOME" ||
            day(e.date) < today ||
            day(e.date) > input.expiresDate ||
            available <= 0
          )
            continue;
          const need = e.servings - e.reservations.reduce((sum, r) => sum + r.servings, 0);
          if (need <= 0) continue;
          const servings = Math.min(need, available);
          await tx.foodReservation.create({ data: { batchId: batch.id, entryId: e.id, servings } });
          available = amount(available - servings);
        }
      } else if (["SERVE", "SERVE_MEAL"].includes(input.action)) {
        const targets =
          input.action === "SERVE"
            ? entry
              ? [entry]
              : []
            : plan.entries.filter(
                (e) =>
                  day(e.date) === today &&
                  e.mealTime === input.mealTime &&
                  e.slotIndex === (input.slotIndex ?? 0) &&
                  e.kind === "HOME",
              );
        if (!targets.length)
          throw new AppError(400, "SERVE_UNAVAILABLE", "오늘의 끼니를 확인해 주세요.");
        for (const servingEntry of targets.filter((e) => !e.served)) {
          if (
            plan.status !== "CONFIRMED" ||
            !servingEntry ||
            servingEntry.kind !== "HOME" ||
            !safeEntry(servingEntry) ||
            day(servingEntry.date) !== today
          )
            throw new AppError(
              400,
              "SERVE_UNAVAILABLE",
              "오늘의 확정 메뉴와 아기 조건을 확인해 주세요.",
            );
          const reserved = servingEntry.reservations.filter(
            (r) => r.batch.expiresDate && day(r.batch.expiresDate) >= today,
          );
          if (reserved.reduce((sum, r) => sum + r.servings, 0) < servingEntry.servings)
            throw new AppError(400, "COOK_FIRST", "먼저 조리 완료로 음식 재고를 등록해 주세요.");
          for (const r of reserved) {
            const moved = await tx.foodBatch.updateMany({
              where: { id: r.batchId, remaining: { gte: r.servings - 0.000001 } },
              data: { remaining: { decrement: r.servings }, version: { increment: 1 } },
            });
            if (!moved.count) throw conflict();
            await tx.foodMovement.create({
              data: {
                batchId: r.batchId,
                kind: "SERVE",
                delta: -r.servings,
                eventKey: `serve:${servingEntry.id}:${r.batchId}`,
              },
            });
          }
          await tx.foodReservation.deleteMany({ where: { entryId: servingEntry.id } });
          await tx.mealPlanEntry.update({ where: { id: servingEntry.id }, data: { served: true } });
          if (servingEntry.recipeId)
            await tx.mealLog.create({
              data: {
                babyId: baby.id,
                recipeId: servingEntry.recipeId!,
                mealTime: servingEntry.mealTime,
                rating:
                  input.amounts?.find((a) => a.entryId === servingEntry.id)?.rating ?? input.rating,
                amountEaten:
                  input.amounts?.find((a) => a.entryId === servingEntry.id)?.amountEaten ??
                  input.amountEaten ??
                  null,
                memo: `주간 식단 · ${servingEntry.servings}회분 제공`,
              },
            });
        }
      }
      if (
        ["ENTRY", "ADD", "REGENERATE", "MEAL_REGENERATE", "CONFIRM", "COOK", "STOCK"].includes(
          input.action,
        )
      ) {
        const rows = await tx.mealPlanEntry.findMany({
          where: { planId },
          include: { reservations: true },
        });
        await rebuildTasks(tx, planId, prefs, rows);
      }
      await tx.mealPlan.update({ where: { id: planId }, data: { revision: { increment: 1 } } });
      return { id: planId };
    },
    prisma,
  );
}

const stockInput = z.object({
  name: z.string().trim().min(1).max(80),
  recipeId: z.string().uuid().optional(),
  category: z.enum(["MEAL", "SNACK"]),
  location: z.enum(["FRIDGE", "FREEZER"]),
  servings: z.number().min(0.1).max(100),
  preparedDate: calendarDate,
  expiresDate: calendarDate.optional(),
  eventKey: z.string().uuid(),
});
export async function addStock(
  userId: string,
  baby: BabyProfileView,
  raw: unknown,
  prisma = getPrisma(),
) {
  const input = stockInput.parse(raw);
  if (
    input.preparedDate > kstDateString(new Date()) ||
    (input.expiresDate && input.expiresDate < input.preparedDate)
  )
    throw new AppError(400, "STOCK_DATE", "조리일과 사용 기한을 확인해 주세요.");
  const recipe = input.recipeId
    ? (await loadRecipeCatalog(baby, prisma)).find((r) => r.id === input.recipeId)
    : null;
  if (input.recipeId && !recipe)
    throw new AppError(400, "RECIPE_UNAVAILABLE", "현재 아기 조건에 맞지 않는 레시피입니다.");
  return serialized(
    userId,
    async (tx) => {
      const old = await tx.foodMovement.findUnique({
        where: { eventKey: input.eventKey },
        include: { batch: true },
      });
      if (old) {
        if (old.batch.userId !== userId) throw conflict();
        return { id: old.batchId };
      }
      const batch = await tx.foodBatch.create({
        data: {
          userId,
          recipeId: recipe?.id,
          name: recipe?.name ?? input.name,
          category: recipe?.category ?? input.category,
          location: input.location,
          preparedDate: date(input.preparedDate),
          expiresDate: input.expiresDate ? date(input.expiresDate) : null,
          remaining: input.servings,
          snapshot: json(recipe ?? {}),
          movements: { create: { eventKey: input.eventKey, kind: "ADD", delta: input.servings } },
        },
      });
      return { id: batch.id };
    },
    prisma,
  );
}

export async function moveStock(userId: string, raw: unknown, prisma = getPrisma()) {
  const input = z
    .object({
      id: z.string().uuid(),
      version: z.number().int(),
      action: z.enum(["DISCARD", "USE", "ADJUST", "MOVE"]),
      servings: z.number().min(0.1).max(100),
      eventKey: z.string().uuid(),
      location: z.enum(["FRIDGE", "FREEZER"]).optional(),
      expiresDate: calendarDate.optional(),
    })
    .parse(raw);
  return serialized(
    userId,
    async (tx) => {
      const old = await tx.foodMovement.findUnique({
        where: { eventKey: input.eventKey },
        include: { batch: true },
      });
      if (old) {
        if (old.batch.userId !== userId) throw conflict();
        return { id: old.batchId };
      }
      const batch = await tx.foodBatch.findFirst({
        where: { id: input.id, userId },
        include: { reservations: true },
      });
      if (!batch) throw new AppError(404, "STOCK_NOT_FOUND", "음식 재고를 찾을 수 없습니다.");
      if (batch.version !== input.version) throw conflict();
      const reserved = batch.reservations.reduce((sum, r) => sum + r.servings, 0);
      const delta =
        input.action === "MOVE"
          ? 0
          : input.action === "ADJUST"
            ? input.servings - batch.remaining
            : -input.servings;
      if (
        input.action === "USE" &&
        (!batch.expiresDate || day(batch.expiresDate) < kstDateString(new Date()))
      )
        throw new AppError(400, "STOCK_EXPIRED", "사용 기한을 확인해 주세요.");
      if (batch.remaining + delta < reserved)
        throw new AppError(
          409,
          "STOCK_RESERVED",
          "식단에 예약된 음식입니다. 식단에서 예약을 해제한 뒤 변경해 주세요.",
        );
      if (batch.remaining + delta < 0)
        throw new AppError(400, "STOCK_SHORT", "남은 회분보다 많이 차감할 수 없습니다.");
      if (
        input.action === "MOVE" &&
        (!input.location ||
          !input.expiresDate ||
          input.expiresDate < kstDateString(new Date()) ||
          (batch.reservations.some((r) => r.entryId) &&
            batch.expiresDate &&
            input.expiresDate < day(batch.expiresDate)))
      )
        throw new AppError(
          400,
          "MOVE_DATE",
          "예약을 해제하고 보관 장소와 사용 기한을 다시 확인해 주세요.",
        );
      await tx.foodBatch.update({
        where: { id: batch.id },
        data: {
          remaining: { increment: delta },
          version: { increment: 1 },
          ...(input.action === "MOVE"
            ? { location: input.location, expiresDate: date(input.expiresDate!) }
            : {}),
        },
      });
      await tx.foodMovement.create({
        data: { batchId: batch.id, eventKey: input.eventKey, kind: input.action, delta },
      });
      return { id: batch.id };
    },
    prisma,
  );
}
