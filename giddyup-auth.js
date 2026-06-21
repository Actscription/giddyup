// ============================================
// GiddyUp Auth — Shared Supabase auth module
// Used by both GiddyUp Silks (index.html) and GiddyUp Play (play.html)
// ============================================

const GIDDYUP_SUPABASE_URL = "https://hubgdpaowrvzbjyvgzxm.supabase.co";
const GIDDYUP_SUPABASE_KEY = "sb_publishable_asjorgsEN9-8KDG3PwvBpA_wyeoL7En";

const giddyupSupabase = supabase.createClient(GIDDYUP_SUPABASE_URL, GIDDYUP_SUPABASE_KEY);

const GiddyUpAuth = {

  // Register a new user with email, password, username, city
  async register(email, password, username, city) {
    const { data, error } = await giddyupSupabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, city }
      }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user };
  },

  // Log in an existing user
  async login(email, password) {
    const { data, error } = await giddyupSupabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user };
  },

  // Log out
  async logout() {
    await giddyupSupabase.auth.signOut();
  },

  // Get the current session (null if not logged in)
  async getSession() {
    const { data } = await giddyupSupabase.auth.getSession();
    return data.session;
  },

  // Get the current user's profile (username, city) from the profiles table
  async getProfile(userId) {
    const { data, error } = await giddyupSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data;
  },

// Save a user's permanent custom Angles to their profile.
  // customAnglesObj is the FULL per-race-type object, e.g.
  // { custom:{weights,locks}, stakes:{weights,locks}, allowance:{...}, claiming:{...}, maiden:{...} }
  // This is "[Username] Angles" — persists across logout, devices, and race days.
  async saveCustomAngles(userId, customAnglesObj) {
    const { data, error } = await giddyupSupabase
      .from("profiles")
      .update({ custom_angles: customAnglesObj })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Listen for auth state changes (login/logout) — callback receives session or null
  onAuthChange(callback) {
    giddyupSupabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },

  // ── PLAY DAY CARD (GiddyUp Play race day data) ──────────────────
  // Stores the entire day's card (numRaces, picks, results, scores,
  // mlPicks, mlScores, guPicks, guScores, partnerName) as one JSON
  // blob per user per day, in the play_picks table (race_number=0
  // is a sentinel "whole day" row; the picks column holds the blob).

  async saveDayCard(userId, playDate, dayCard) {
    const { data, error } = await giddyupSupabase
      .from("play_picks")
      .upsert({
        user_id: userId,
        play_date: playDate,
        race_number: 0,
        picks: dayCard,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,play_date,race_number" })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getDayCard(userId, playDate) {
    const { data, error } = await giddyupSupabase
      .from("play_picks")
      .select("*")
      .eq("user_id", userId)
      .eq("play_date", playDate)
      .eq("race_number", 0)
      .maybeSingle();
    if (error || !data) return null;
    return data.picks;
  }

};
