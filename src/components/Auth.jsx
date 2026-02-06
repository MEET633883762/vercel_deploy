import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Signup successful. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err.message || "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <div className="card nv-card">
        <div className="card-body">
          <h4 className="mb-1">{mode === "signup" ? "Create account" : "Login"}</h4>
          <div className="text-secondary mb-3">
            Track meals, calories, and macros per user.
          </div>

          <form onSubmit={submit} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label">Email</label>
              <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button className="btn btn-success" disabled={loading} type="submit">
              {loading ? "Please wait..." : (mode === "signup" ? "Sign up" : "Login")}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMsg(""); }}
            >
              Switch to {mode === "signup" ? "Login" : "Sign up"}
            </button>

            {msg ? <div className="alert alert-info mb-0">{msg}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
