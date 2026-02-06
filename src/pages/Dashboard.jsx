import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Flame, Beef, Wheat, Droplet, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";

/* 🔥 ADD THIS BLOCK RIGHT HERE */
const ActiveBar = (props) => {
  const { x, y, width, height, fill, payload } = props;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={10} />
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fill="#111827"
        fontSize={12}
        fontWeight="600"
      >
        {Math.round(payload.calories)} kcal
      </text>
    </g>
  );
};

// If you keep your bucket private, this will create signed URLs for images.
// If you made it public, you can replace this with getPublicUrl.
async function resolveSignedUrls(meals, limit = 12) {
  const out = [...meals];
  const targets = out.filter((m) => m.image_url).slice(0, limit);

  await Promise.all(
    targets.map(async (m) => {
      const { data, error } = await supabase.storage
        .from("meal-images")
        .createSignedUrl(m.image_url, 60 * 60); // 1 hour
      if (!error && data?.signedUrl) m._imageSignedUrl = data.signedUrl;
    }),
  );

  return out;
}

function startOfTodayLocalISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function ProgressCard({ icon, label, value, target, unit }) {
  const pct = Math.max(0, Math.min(1, target ? value / target : 0));
  return (
    <div className="metricCard">
      <div className="metricTop">
        <div className="metricIcon">{icon}</div>
        <div className="metricLabel">{label}</div>
      </div>

      <div className="metricValue">
        <span className="big">{Math.round(value)}</span>
        <span className="muted">
          {" "}
          / {Math.round(target)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>

      <div className="metricBar">
        <div className="metricFill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="tooltip">
      <div className="tooltipTitle">{label}</div>
      <div className="tooltipRow">
        <span>Calories:</span>
        <b>{Math.round(payload[0].value)} kcal</b>
      </div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [meals, setMeals] = useState([]);
  const [onlyToday, setOnlyToday] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      let q = supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (onlyToday) {
        q = q.gte("created_at", startOfTodayLocalISO());
      }

      const { data, error } = await q;
      if (error) throw error;

      const resolved = await resolveSignedUrls(data || []);
      setMeals(resolved);
    } catch (e) {
      setErr(e?.message || "Failed to load meals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, onlyToday]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => {
        acc.calories += m.calories || 0;
        acc.protein += m.protein_g || 0;
        acc.carbs += m.carbs_g || 0;
        acc.fat += m.fat_g || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [meals]);

  const targets = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

  const donutData = useMemo(
    () => [
      { name: "Protein", value: Math.max(0, totals.protein) },
      { name: "Carbs", value: Math.max(0, totals.carbs) },
      { name: "Fat", value: Math.max(0, totals.fat) },
    ],
    [totals],
  );

  // Recharts wants fill; keep it stable (your CSS colors won’t apply to SVG)
  const donutColors = ["#3b82f6", "#fbbf24", "#ec4899"];

  // Simple weekly chart based on existing meals timestamps
  const weekly = useMemo(() => {
    // Group last 7 days (local)
    const buckets = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      buckets.push({
        key,
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        calories: 0,
      });
    }

    const map = new Map(buckets.map((b) => [b.key, b]));
    meals.forEach((m) => {
      const k = (m.created_at || "").slice(0, 10);
      if (map.has(k)) map.get(k).calories += m.calories || 0;
    });

    return buckets;
  }, [meals]);

  const removeMeal = async (id) => {
    try {
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
      setMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setErr(e?.message || "Delete failed");
    }
  };

  return (
    <div className="page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="mb-0">Dashboard</h3>
          <div className="text-secondary small">
            {onlyToday ? "Today’s totals" : "Recent totals"} • {meals.length}{" "}
            meal(s)
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <div className="form-check form-switch mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={onlyToday}
              onChange={(e) => setOnlyToday(e.target.checked)}
              id="onlyToday"
            />
            <label className="form-check-label" htmlFor="onlyToday">
              Today only
            </label>
          </div>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} className="me-2" />
            Refresh
          </button>
        </div>
      </div>

      {err ? <div className="alert alert-danger">{err}</div> : null}

      <div className="gridTopCards">
        <ProgressCard
          icon={<Flame size={18} />}
          label="Calories"
          value={totals.calories}
          target={targets.calories}
        />
        <ProgressCard
          icon={<Beef size={18} />}
          label="Protein"
          value={totals.protein}
          target={targets.protein}
          unit="g"
        />
        <ProgressCard
          icon={<Wheat size={18} />}
          label="Carbs"
          value={totals.carbs}
          target={targets.carbs}
          unit="g"
        />
        <ProgressCard
          icon={<Droplet size={18} />}
          label="Fat"
          value={totals.fat}
          target={targets.fat}
          unit="g"
        />
      </div>

      <div className="gridCharts">
        <div className="card chartCard">
          <div className="cardTitle">Macro Distribution</div>

          <div className="chartWrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {donutData.map((_, idx) => (
                    <Cell key={idx} fill={donutColors[idx]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="legend">
              <div className="legendRow">
                <span className="dot" style={{ background: donutColors[0] }} />
                <span>Protein: {Math.round(totals.protein)}g</span>
              </div>
              <div className="legendRow">
                <span className="dot" style={{ background: donutColors[1] }} />
                <span>Carbs: {Math.round(totals.carbs)}g</span>
              </div>
              <div className="legendRow">
                <span className="dot" style={{ background: donutColors[2] }} />
                <span>Fat: {Math.round(totals.fat)}g</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card chartCard">
          <div className="cardTitle">Last 7 days calories</div>

          <div className="chartWrap">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={weekly}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="calories"
                  name="Calories"
                  fill="#18a77b"
                  radius={[10, 10, 0, 0]}
                  activeBar={<ActiveBar />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card mealsCard mt-3">
        <div className="mealsHeader">
          <div className="cardTitle">Meals</div>
          <div className="muted">
            {loading ? "Loading..." : `${meals.length} item(s)`}
          </div>
        </div>

        {!loading && meals.length === 0 ? (
          <div className="empty">
            No meals yet. Go to Scan Food and “Add to Dashboard”.
          </div>
        ) : (
          <div className="mealsList">
            {meals.map((m) => (
              <div key={m.id} className="mealRow">
                <div className="mealLeft">
                  <div className="mealAvatar">
                    {m._imageSignedUrl ? (
                      <img
                        src={m._imageSignedUrl}
                        alt="meal"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="mealPlaceholder" />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div className="mealTopLine">
                      <b
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.title || "Meal"}
                      </b>
                      <span className="muted">
                        {" "}
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="muted small">
                      {m.grams ? `${m.grams}g` : ""}{" "}
                      {m.detected_label ? `• ${m.detected_label}` : ""}
                    </div>

                    <div className="mealCals">
                      <b>{Math.round(m.calories || 0)} kcal</b>{" "}
                      <span className="muted small">
                        • P {Math.round(m.protein_g || 0)}g • C{" "}
                        {Math.round(m.carbs_g || 0)}g • F{" "}
                        {Math.round(m.fat_g || 0)}g
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="iconDanger"
                  onClick={() => removeMeal(m.id)}
                  title="Delete"
                  type="button"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
