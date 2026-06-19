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

  // Listen for auth state changes (login/logout) — callback receives session or null
  onAuthChange(callback) {
    giddyupSupabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }

};
