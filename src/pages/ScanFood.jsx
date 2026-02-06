import React, { useMemo, useState } from "react";
import { Camera, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { supabase } from "../supabaseClient";

function hasAndroidHealthBridge() {
  return (
    typeof window !== "undefined" &&
    window.AndroidHealth &&
    typeof window.AndroidHealth.syncMeal === "function"
  );
}

async function uploadMealImage(userId, file) {
  // Requires a Supabase storage bucket named "meal-images"
  // Policy: authenticated can insert
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("meal-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (upErr) throw upErr;
  return path; // store the path; dashboard can resolve signed URL if needed
}

export default function ScanFood({ user, onRequireLogin }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [grams, setGrams] = useState(200);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [err, setErr] = useState("");

  const [syncMsg, setSyncMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const onPick = (f) => {
    setFile(f);
    setErr("");
    setSyncMsg("");
    setSaveMsg("");
    setResult(null);
    setSelectedLabel("");

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setErr("");
    setSyncMsg("");
    setSaveMsg("");

    try {
      const form = new FormData();
      form.append("image", file);

      // expected backend:
      // POST /predict-and-nutrition?top_k=5&grams=200
      const res = await api.post(
        `/predict-and-nutrition?top_k=5&grams=${grams}`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      setResult(res.data);

      const preds = res.data?.predictions || [];
      const top1 = preds[0];
      const top1Label = (top1?.label || "").replaceAll("_", " ").trim();
      const top1Score = top1?.score ?? 0;

      // auto-select only if confident
      if (top1Label && top1Score >= 0.4) setSelectedLabel(top1Label);
      else setSelectedLabel("");
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchNutritionFor = async (label) => {
    const q = (label || "").trim();
    if (!q) return;

    setLoading(true);
    setErr("");
    setSyncMsg("");
    setSaveMsg("");

    try {
      // expected backend:
      // GET /nutrition?query=...&grams=200
      const res = await api.get(
        `/nutrition?query=${encodeURIComponent(q)}&grams=${encodeURIComponent(grams)}`,
      );

      setResult((prev) => ({
        ...(prev || {}),
        used_query: q,
        nutrition: res.data,
      }));
      setSelectedLabel(q);
    } catch (e) {
      setErr(
        e?.response?.data?.detail || e?.message || "Nutrition lookup failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const predictions = useMemo(
    () => result?.predictions || [],
    [result?.predictions],
  );
  const usedQuery = (result?.used_query || "").replaceAll("_", " ").trim();

  const macros = result?.nutrition?.nutrients_for_grams || {};
  const kcal = Number(macros["Energy"] || 0);
  const fat = Number(macros["Total lipid (fat)"] || 0);
  const carbs = Number(macros["Carbohydrate, by difference"] || 0);
  const protein = Number(macros["Protein"] || 0);

  const topScore = predictions?.[0]?.score ?? 0;
  const needsPick = !!result && (!selectedLabel || topScore < 0.4);

  const displayCandidates = useMemo(
    () =>
      predictions.slice(0, 5).map((p) => ({
        label: (p.label || "").replaceAll("_", " ").trim(),
        score: p.score ?? 0,
      })),
    [predictions],
  );

  const syncToHealthConnect = () => {
    setSyncMsg("");
    setSaveMsg("");

    if (!result || !selectedLabel) return;

    if (!hasAndroidHealthBridge()) {
      setSyncMsg(
        "Health Connect sync only works inside the Android WebView wrapper (AndroidHealth bridge).",
      );
      return;
    }

    const meal = {
      time: new Date().toISOString(),
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      name: usedQuery || selectedLabel || "Meal",
    };

    try {
      window.AndroidHealth.syncMeal(JSON.stringify(meal));
      setSyncMsg(
        "Sent to Android. Approve Health Connect permissions if prompted.",
      );
    } catch (e) {
      setSyncMsg(`Android bridge call failed: ${e?.message || String(e)}`);
    }
  };

  const addToDashboard = async () => {
    setSaveMsg("Saved to Dashboard ✅");
    setSyncMsg("");

    if (!user?.id) {
      setSaveMsg("Not logged in.");
      return;
    }
    if (!result || !selectedLabel) {
      setSaveMsg("Analyze + select a label first.");
      return;
    }

    // Basic sanity check: avoid writing obviously empty meals
    if (Math.round(kcal) <= 0) {
      setSaveMsg("Calories are 0 — not saving. Fix the label/portion first.");
      return;
    }

    setLoading(true);
    try {
      let imagePath = null;

      // Optional storage upload
      if (file) {
        try {
          imagePath = await uploadMealImage(user.id, file);
        } catch (e) {
          console.error("Image upload failed:", e);
          imagePath = null;
        }
      }

      const row = {
        user_id: user.id,
        title: usedQuery || selectedLabel || "Meal",
        detected_label: selectedLabel,
        grams: grams,
        calories: Math.round(kcal),
        protein_g: Math.round(protein),
        carbs_g: Math.round(carbs),
        fat_g: Math.round(fat),
        image_url: imagePath, // storage path, not a public URL
      };

      const { error } = await supabase.from("meals").insert(row);
      if (error) throw error;

      setSaveMsg("Saved to Dashboard ✅");
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-7">
        <div className="card nv-card">
          <div className="card-body">
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div>
                <h3 className="mb-1">AI Food Scanner</h3>
                <div className="text-secondary">
                  Upload a photo → confirm label → get nutrition → save to your
                  account.
                </div>
              </div>
              <div className="d-none d-md-flex align-items-center gap-2">
                <span className="badge text-bg-success-subtle text-success border border-success-subtle">
                  <Camera size={14} className="me-1" />
                  Image-based
                </span>
                <span className="badge text-bg-secondary-subtle text-secondary border">
                  Approx macros
                </span>
              </div>
            </div>

            <hr />

            <div className="d-flex flex-column gap-3">
              <div>
                <label className="form-label fw-semibold">Food image</label>
                <input
                  className="form-control"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && onPick(e.target.files[0])
                  }
                />
                <div className="form-text">
                  Mixed dishes won’t be perfect. Confirm label before saving.
                </div>
              </div>

              {preview ? (
                <div className="d-flex justify-content-center">
                  <img
                    className="nv-preview"
                    src={preview}
                    alt="food preview"
                  />
                </div>
              ) : (
                <div className="text-center py-4 nv-muted">
                  <UploadCloud size={28} className="mb-2" />
                  <div>No image selected</div>
                </div>
              )}

              <div>
                <div className="d-flex align-items-center justify-content-between">
                  <label className="form-label fw-semibold mb-0">
                    Portion size
                  </label>
                  <span className="badge text-bg-secondary">{grams} g</span>
                </div>
                <input
                  className="form-range"
                  type="range"
                  min="50"
                  max="900"
                  step="10"
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value))}
                  onMouseUp={() =>
                    selectedLabel && fetchNutritionFor(selectedLabel)
                  }
                  onTouchEnd={() =>
                    selectedLabel && fetchNutritionFor(selectedLabel)
                  }
                />
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-success"
                  disabled={!file || loading}
                  onClick={analyze}
                  type="button"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>

                <button
                  className="btn btn-outline-primary"
                  disabled={!result || !selectedLabel || loading || !user?.id}
                  onClick={() => {
                    if (!user?.id) return onRequireLogin?.();
                    addToDashboard();
                  }}
                  type="button"
                  title={
                    !user?.id
                      ? "Login required"
                      : !result || !selectedLabel
                        ? "Analyze and select a label first"
                        : ""
                  }
                >
                  Add to Dashboard
                </button>
                {!user?.id ? (
                  <div className="text-secondary small">
                    <small>Login to save meals to your dashboard.</small>
                  </div>
                ) : null}

                <button
                  className="btn btn-outline-success"
                  disabled={!result || !selectedLabel || loading}
                  onClick={syncToHealthConnect}
                  type="button"
                  title={
                    hasAndroidHealthBridge()
                      ? "Write meal to Health Connect"
                      : "Requires Android WebView bridge"
                  }
                >
                  Sync to Health Connect
                </button>
              </div>

              {err ? (
                <div
                  className="alert alert-danger d-flex align-items-start gap-2 mb-0"
                  role="alert"
                >
                  <AlertTriangle size={18} className="mt-1" />
                  <div>{err}</div>
                </div>
              ) : null}

              {saveMsg ? (
                <div
                  className="alert alert-success d-flex align-items-start gap-2 mb-0"
                  role="alert"
                >
                  <CheckCircle2 size={18} className="mt-1" />
                  <div>{saveMsg}</div>
                </div>
              ) : null}

              {syncMsg ? (
                <div
                  className="alert alert-info d-flex align-items-start gap-2 mb-0"
                  role="alert"
                >
                  <CheckCircle2 size={18} className="mt-1" />
                  <div>{syncMsg}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-5">
        <div className="card nv-card h-100">
          <div className="card-body">
            <h5 className="mb-2">Detection & Nutrition</h5>
            <div className="text-secondary small mb-3">
              This is an estimate. Don’t save until the label looks right.
            </div>

            {!result ? (
              <div className="text-secondary">
                Run an analysis to see predictions and macros.
              </div>
            ) : (
              <>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">
                    Selected:{" "}
                    <span className="text-success">
                      {usedQuery || selectedLabel || "—"}
                    </span>
                  </div>
                  {predictions?.[0]?.score != null ? (
                    <span className="badge text-bg-secondary">
                      {(predictions[0].score * 100).toFixed(1)}% conf.
                    </span>
                  ) : null}
                </div>

                {needsPick ? (
                  <div className="alert alert-warning mb-3" role="alert">
                    Low confidence. Pick the right item below.
                  </div>
                ) : null}

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {displayCandidates.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      className={`btn btn-sm nv-chip ${c.label === selectedLabel ? "active" : ""}`}
                      onClick={() => fetchNutritionFor(c.label)}
                      title={`Use ${c.label} (${(c.score * 100).toFixed(1)}%)`}
                    >
                      {c.label}{" "}
                      <span className="text-secondary">
                        ({(c.score * 100).toFixed(0)}%)
                      </span>
                    </button>
                  ))}
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <div className="p-3 nv-macro">
                      <div className="text-secondary small">Calories</div>
                      <div className="fs-4 fw-semibold">{Math.round(kcal)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 nv-macro">
                      <div className="text-secondary small">Protein (g)</div>
                      <div className="fs-4 fw-semibold">
                        {Math.round(protein)}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 nv-macro">
                      <div className="text-secondary small">Carbs (g)</div>
                      <div className="fs-4 fw-semibold">
                        {Math.round(carbs)}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 nv-macro">
                      <div className="text-secondary small">Fat (g)</div>
                      <div className="fs-4 fw-semibold">{Math.round(fat)}</div>
                    </div>
                  </div>
                </div>

                <div className="text-secondary small mt-3">
                  If the label is wrong, click a different candidate. Portion
                  changes update macros.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
