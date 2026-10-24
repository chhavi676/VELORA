import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import "./AuthPanel.css";

const DASH_LABEL = { admin: "Open admin dashboard", designer: "Open designer dashboard", model: "Open model area", customer: "View my orders" };

export default function AuthPanel() {
  const { session, profile, loading, error: profileError, signOut } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) { setMessage("Supabase is not configured. Check client/.env and restart Vite."); return; }
    setBusy(true); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) setMessage("Account created and signed in.");
        else { setMessage("Sign-up started. Check your email to confirm the account, then sign in."); setMode("signin"); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage("Signed in successfully.");
      }
    } catch (error) { setMessage(error.message || "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function handleGoogle() {
    if (!supabase) { setMessage("Supabase is not configured. Check client/.env and restart Vite."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setMessage(error.message); setBusy(false); }
  }

  async function handleSignOut() {
    setBusy(true);
    try { await signOut(); setMessage("Signed out."); } catch (e) { setMessage(e.message); }
    setBusy(false);
  }

  if (session && loading) return <section className="velora-auth"><p className="velora-auth__muted">Loading your profile…</p></section>;

  if (session && profile) {
    return <section className="velora-auth" aria-label="Account">
      <div className="velora-auth__identity">
        {profile.avatarUrl ? <img className="velora-auth__avatar" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
        <div><p className="velora-auth__eyebrow">SIGNED IN</p><h3>{profile.fullName || profile.email}</h3><p className="velora-auth__muted">{profile.email}</p></div>
      </div>
      <p className="velora-auth__role">Account role: <strong>{profile.role}</strong></p>
      <a className="velora-auth__button velora-auth__button--link" href="#/dashboard">{DASH_LABEL[profile.role] || DASH_LABEL.customer}</a>
      <button className="velora-auth__button velora-auth__button--secondary" type="button" disabled={busy} onClick={handleSignOut}>{busy ? "Please wait…" : "Sign out"}</button>
      {message ? <p className="velora-auth__message" role="status">{message}</p> : null}
    </section>;
  }

  return <section className="velora-auth" aria-label="Sign in to VÉLORA">
    <p className="velora-auth__eyebrow">VÉLORA ACCOUNT</p>
    <h3>{mode === "signup" ? "Create your account" : "Sign in"}</h3>
    <p className="velora-auth__muted">Access your account and fashion profile.</p>
    <form className="velora-auth__form" onSubmit={handleSubmit}>
      {mode === "signup" ? <label>Full name<input autoComplete="name" maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} required /></label> : null}
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <button className="velora-auth__button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in with email"}</button>
    </form>
    <div className="velora-auth__separator"><span>OR</span></div>
    <button className="velora-auth__button velora-auth__button--secondary" type="button" disabled={busy} onClick={handleGoogle}>Continue with Google</button>
    <button className="velora-auth__link" type="button" disabled={busy} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }}>
      {mode === "signup" ? "Already have an account? Sign in" : "New to VÉLORA? Create an account"}
    </button>
    {message ? <p className="velora-auth__message" role="status">{message}</p> : null}
    {profileError ? <p className="velora-auth__message" role="alert">{profileError}</p> : null}
    <p className="velora-auth__fineprint">New accounts start as customers. Model and designer access must be granted by an administrator.</p>
  </section>;
}
