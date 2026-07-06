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
  },

  // ── PUBLISHED RACE CARDS (daily card for all users) ─────────────
  // One row per race day in the race_cards table. The `card` column
  // (jsonb) holds the entire analyzed day:
  // { track, races: [ { label, raceType, horses:[...] } ] }
  // Admin (Carm) publishes once each morning; all users load it
  // instantly — no PDF upload, no Vision API call.

  async publishCard(raceDate, cardObj, userId) {
    const { data, error } = await giddyupSupabase
      .from("race_cards")
      .upsert({
        race_date: raceDate,
        card: cardObj,
        published_by: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: "race_date" })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getPublishedCard(raceDate) {
    const { data, error } = await giddyupSupabase
      .from("race_cards")
      .select("*")
      .eq("race_date", raceDate)
      .maybeSingle();
    if (error || !data) return null;
    return data.card;
  },

  // ── LIVE TRAINER/JOCKEY COMBO DATA ──────────────────────────────
  // Looks up real win-rate history for a trainer/jockey pairing,
  // circuit-wide (not limited to one track) — Alberta racing is a
  // small circuit and the same people move between tracks all season.
  // Names are fuzzy-matched (periods/spacing tolerant) since PP sheets
  // and stored results don't always format names identically
  // (e.g. "Lyle W Magnuson" vs "Lyle W. Magnuson").
  // Returns null if there's no meaningful sample (< minStarts),
  // so callers can safely fall back to the AI-estimated combo stat.

  fuzzyName(s) {
    return "%" + s.trim().replace(/\./g, "").split(/\s+/).join("%") + "%";
  },

  async getComboStats(trainer, jockey, minStarts = 5) {
    if (!trainer || !jockey) return null;
    const { data, error } = await giddyupSupabase
      .from("jockey_trainer_combo_stats")
      .select("*")
      .ilike("trainer", this.fuzzyName(trainer))
      .ilike("jockey", this.fuzzyName(jockey))
      .maybeSingle();
    if (error || !data || data.starts < minStarts) return null;
    return data;
  },

  // ── LIVE STANDALONE JOCKEY / TRAINER DATA ───────────────────────
  // Same circuit-wide, fuzzy-matched approach as getComboStats, but
  // for the standalone Jockey and Trainer factors (rider/trainer
  // general win rate, independent of who they're paired with).

  async getJockeyStats(jockey, minStarts = 5) {
    if (!jockey) return null;
    const { data, error } = await giddyupSupabase
      .from("jockey_stats")
      .select("*")
      .ilike("jockey", this.fuzzyName(jockey))
      .maybeSingle();
    if (error || !data || data.starts < minStarts) return null;
    return data;
  },

  async getTrainerStats(trainer, minStarts = 5) {
    if (!trainer) return null;
    const { data, error } = await giddyupSupabase
      .from("trainer_stats")
      .select("*")
      .ilike("trainer", this.fuzzyName(trainer))
      .maybeSingle();
    if (error || !data || data.starts < minStarts) return null;
    return data;
  }

};
