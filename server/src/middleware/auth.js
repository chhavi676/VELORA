import { createClient } from "@supabase/supabase-js";
import UserProfile from "../models/UserProfile.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn("Supabase auth is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in server/.env");
}

const supabaseAuthClient = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  : null;

function getDisplayName(user) {
  const metadata = user.user_metadata || {};
  return String(metadata.full_name || metadata.name || metadata.user_name || "").trim().slice(0, 120);
}

function getAvatarUrl(user) {
  const metadata = user.user_metadata || {};
  const value = metadata.avatar_url || metadata.picture || "";
  // Store only HTTP(S) URLs. This is profile display data, never authorization input.
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href.slice(0, 1000) : "";
  } catch {
    return "";
  }
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "A valid Bearer access token is required." });
    if (!supabaseAuthClient) {
      return res.status(503).json({ error: "Authentication is not configured on the server." });
    }

    // getUser(token) verifies the token with Supabase Auth; do not trust decoded client claims.
    const { data, error } = await supabaseAuthClient.auth.getUser(match[1]);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired session." });

    const authUser = data.user;
    const email = String(authUser.email || "").trim().toLowerCase();
    if (!email) return res.status(403).json({ error: "This account has no email address." });

    const bootstrapAdminEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
    const isConfirmed = Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
    const bootstrapAdmin = Boolean(bootstrapAdminEmail && email === bootstrapAdminEmail && isConfirmed);
    const profileUpdate = {
      email,
      fullName: getDisplayName(authUser),
      avatarUrl: getAvatarUrl(authUser),
    };

    // Role is deliberately not copied from user_metadata/app_metadata sent by the browser.
    let profile = await UserProfile.findOne({ supabaseUserId: authUser.id });
    if (!profile) {
      profile = await UserProfile.create({
        supabaseUserId: authUser.id,
        ...profileUpdate,
        role: bootstrapAdmin ? "admin" : "customer",
      });
    } else {
      profile.email = profileUpdate.email;
      if (profileUpdate.fullName) profile.fullName = profileUpdate.fullName;
      if (profileUpdate.avatarUrl) profile.avatarUrl = profileUpdate.avatarUrl;
      if (bootstrapAdmin) profile.role = "admin";
      await profile.save();
    }

    req.authUser = authUser;
    req.userProfile = profile;
    return next();
  } catch (error) {
    if (error?.code === 11000) {
      // Concurrent first requests can race on the unique Supabase ID. Re-read the profile.
      try {
        const { data } = await supabaseAuthClient.auth.getUser((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
        if (data?.user) {
          const profile = await UserProfile.findOne({ supabaseUserId: data.user.id });
          if (profile) { req.authUser = data.user; req.userProfile = profile; return next(); }
        }
      } catch { /* handled by generic response below */ }
    }
    console.error("Auth middleware error:", error.message);
    return res.status(500).json({ error: "Could not synchronize the authenticated profile." });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userProfile) return res.status(401).json({ error: "Authentication required." });
    if (!allowedRoles.includes(req.userProfile.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}
