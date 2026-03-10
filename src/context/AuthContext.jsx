import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

const mapProfile = (profile) => ({
  id: profile.id,
  email: profile.email,
  name: profile.name || "",
  role: profile.role || "staff",
  assignedStage: profile.assigned_stage || "",
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role, assigned_stage")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setProfileLoading(false);
      throw error;
    }
    const mapped = data ? mapProfile(data) : null;
    setProfile(mapped);
    setProfileLoading(false);
    return mapped;
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrateFromSession = (session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);

      if (sessionUser) {
        // Do not block auth bootstrap on profile fetch; mobile resume can be slow.
        loadProfile(sessionUser.id).catch(() => {
          // If profile lookup fails, keep auth user but clear profile to avoid stale role state.
          setProfile(null);
          setProfileLoading(false);
        });
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        hydrateFromSession(session);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      hydrateFromSession(session);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase
      .channel(`realtime-profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        async () => {
          try {
            await loadProfile(user.id);
          } catch {
            setProfile(null);
            setProfileLoading(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProfile, user?.id]);

  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    profileLoading,
    refreshProfile,
  }), [loading, profile, profileLoading, refreshProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
