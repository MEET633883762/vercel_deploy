import React, { useEffect, useMemo, useState } from "react";
import {
  Leaf,
  ScanLine,
  LayoutDashboard,
  Wand2,
  LogOut,
  Moon,
  Sun,
  User,
} from "lucide-react";
import { supabase } from "./supabaseClient";

import Auth from "./components/Auth";
import ScanFood from "./pages/ScanFood";
import Dashboard from "./pages/Dashboard";
import MealHelper from "./pages/MealHelper";

export default function App() {
  const [page, setPage] = useState("scan"); // scan | dashboard | helper
  const [dark, setDark] = useState(false);

  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  const user = session?.user || null;
  const isGuest = !user;

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-bs-theme",
      dark ? "dark" : "light",
    );
  }, [dark]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession || null);
      },
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if(user) setShowAuth(false); }, [user]);
  // Hard gate: guests cannot be on dashboard/helper
  useEffect(() => {
    if (isGuest && (page === "dashboard" || page === "helper")) {
      setPage("scan");
    }
  }, [isGuest, page]);

  const logout = async () => {
    await supabase.auth.signOut();
    setPage("scan");
  };

  const Page = useMemo(() => {
    if (page === "dashboard") return <Dashboard user={user} />;
    if (page === "helper") return <MealHelper user={user} />;
    return <ScanFood user={user} onRequireLogin={() => setShowAuth(true)} />;
  }, [page, user]);

  const navBtn = (key, label, Icon, disabled = false) => (
    <button
      type="button"
      className={`btn btn-sm ${page === key ? "btn-success" : "btn-outline-success"}`}
      onClick={() => !disabled && setPage(key)}
      disabled={disabled}
      title={disabled ? "Login required" : ""}
    >
      <Icon size={16} className="me-2" />
      {label}
    </button>
  );

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg border-bottom bg-body-tertiary">
        <div className="container">
          <button
            className="navbar-brand d-flex align-items-center gap-2 border-0 bg-transparent p-0"
            onClick={() => setPage("scan")}
            type="button"
          >
            <span className="nv-brand-badge">
              <Leaf size={18} />
            </span>
            <span className="d-flex flex-column lh-sm">
              <span className="fw-semibold">NutriVision</span>
              <small className="text-secondary">
                {user?.email || "Guest mode"}
              </small>
            </span>
          </button>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <div className="d-none d-md-flex gap-2">
              {navBtn("scan", "Scan Food", ScanLine)}
              {navBtn("dashboard", "Dashboard", LayoutDashboard, isGuest)}
              {navBtn("helper", "Meal Helper", Wand2, isGuest)}
            </div>

            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setDark((v) => !v)}
              type="button"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isGuest ? (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowAuth((v) => !v)}
                type="button"
              >
                <User size={16} className="me-2" />
                Login / Signup
              </button>
            ) : (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={logout}
                type="button"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="container py-4 flex-grow-1">
        {showAuth ? (
          <>
            <Auth />
            <div className="text-center mt-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowAuth(false)}
                 type="button"
              >
                Close
              </button>
            </div>
            </>
        ) : ( 
          Page
          )}
      </main>

      <footer className="nv-footer py-4 bg-body-tertiary">
        <div className="container d-flex justify-content-between">
          <div className="text-secondary small">
            AI Food Recognition + Supabase tracking
          </div>
          <div className="text-secondary small">© 2026</div>
        </div>
      </footer>
    </div>
  );
}
