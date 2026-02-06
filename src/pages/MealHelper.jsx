import React, { useMemo, useState } from "react";

// Simple preset “meal templates” (per serving)
const MEALS = [
  { name: "Chicken + Rice", kcal: 550, p: 40, c: 60, f: 12 },
  { name: "Egg Omelette + Toast", kcal: 420, p: 25, c: 30, f: 20 },
  { name: "Dal + Roti", kcal: 480, p: 22, c: 75, f: 10 },
  { name: "Paneer Bowl", kcal: 520, p: 35, c: 25, f: 28 },
  { name: "Greek Yogurt + Fruit", kcal: 300, p: 20, c: 35, f: 6 },
  { name: "Protein Shake", kcal: 250, p: 30, c: 10, f: 5 }
];

function scoreMeal(remaining, meal) {
  // Lower is better. Weighted distance on macros + calories.
  const dk = remaining.kcal - meal.kcal;
  const dp = remaining.p - meal.p;
  const dc = remaining.c - meal.c;
  const df = remaining.f - meal.f;

  return Math.abs(dk) * 1.0 + Math.abs(dp) * 8 + Math.abs(dc) * 3 + Math.abs(df) * 6;
}

export default function MealHelper() {
  const [target, setTarget] = useState({ kcal: 2000, p: 120, c: 250, f: 65 });
  const [current, setCurrent] = useState({ kcal: 0, p: 0, c: 0, f: 0 });

  const remaining = useMemo(() => ({
    kcal: Math.max(0, target.kcal - current.kcal),
    p: Math.max(0, target.p - current.p),
    c: Math.max(0, target.c - current.c),
    f: Math.max(0, target.f - current.f)
  }), [target, current]);

  const best = useMemo(() => {
    // find best template, then scale it to remaining calories (bounded)
    let bestMeal = MEALS[0];
    let bestScore = Infinity;

    for (const m of MEALS) {
      const s = scoreMeal(remaining, m);
      if (s < bestScore) {
        bestScore = s;
        bestMeal = m;
      }
    }

    // scale factor by calories to better hit remaining (cap to 0.5x..2x)
    const factorRaw = remaining.kcal > 0 ? remaining.kcal / bestMeal.kcal : 1;
    const factor = Math.max(0.5, Math.min(2.0, factorRaw));

    return {
      template: bestMeal,
      factor,
      kcal: Math.round(bestMeal.kcal * factor),
      p: Math.round(bestMeal.p * factor),
      c: Math.round(bestMeal.c * factor),
      f: Math.round(bestMeal.f * factor),
    };
  }, [remaining]);

  const num = (v) => Number(v || 0);

  return (
    <div className="card nv-card">
      <div className="card-body">
        <h4 className="mb-1">Meal Helper</h4>
        <div className="text-secondary mb-3">
          Set your daily target and what you’ve eaten so far. This suggests a meal to close the gap.
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="p-3 nv-macro">
              <div className="fw-semibold mb-2">Daily target</div>
              <div className="row g-2">
                {["kcal","p","c","f"].map((k) => (
                  <div key={k} className="col-6">
                    <label className="form-label small mb-1">
                      {k === "kcal" ? "Calories" : k === "p" ? "Protein" : k === "c" ? "Carbs" : "Fat"}
                      {k === "kcal" ? "" : " (g)"}
                    </label>
                    <input
                      className="form-control"
                      type="number"
                      value={target[k]}
                      onChange={(e) => setTarget(t => ({ ...t, [k]: num(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="p-3 nv-macro">
              <div className="fw-semibold mb-2">Consumed so far</div>
              <div className="row g-2">
                {["kcal","p","c","f"].map((k) => (
                  <div key={k} className="col-6">
                    <label className="form-label small mb-1">
                      {k === "kcal" ? "Calories" : k === "p" ? "Protein" : k === "c" ? "Carbs" : "Fat"}
                      {k === "kcal" ? "" : " (g)"}
                    </label>
                    <input
                      className="form-control"
                      type="number"
                      value={current[k]}
                      onChange={(e) => setCurrent(t => ({ ...t, [k]: num(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <hr />

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="p-3 nv-macro">
              <div className="fw-semibold mb-2">Remaining</div>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge text-bg-secondary">Calories: {remaining.kcal}</span>
                <span className="badge text-bg-secondary">Protein: {remaining.p}g</span>
                <span className="badge text-bg-secondary">Carbs: {remaining.c}g</span>
                <span className="badge text-bg-secondary">Fat: {remaining.f}g</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="p-3 nv-macro">
              <div className="fw-semibold mb-2">Suggested meal</div>
              <div className="fs-5 fw-semibold">{best.template.name}</div>
              <div className="text-secondary small mb-2">
                Portion scale: {(best.factor * 100).toFixed(0)}%
              </div>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge text-bg-success">Calories: {best.kcal}</span>
                <span className="badge text-bg-success">Protein: {best.p}g</span>
                <span className="badge text-bg-success">Carbs: {best.c}g</span>
                <span className="badge text-bg-success">Fat: {best.f}g</span>
              </div>
              <div className="text-secondary small mt-2">
                This is a heuristic match, not a diet plan. Adjust meal choice manually if needed.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
