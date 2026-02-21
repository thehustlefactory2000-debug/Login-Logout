import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const Dashboard = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message || "Failed to load user.");
        setLoading(false);
        return;
      }
      setEmail(user?.email || "");
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="glass-card p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 mb-6">You are signed in.</p>

          {loading && <p className="text-gray-500">Loading account...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && (
            <div className="p-4 rounded-xl bg-white/70 border border-gray-200 mb-6">
              <p className="text-sm text-gray-500">Signed in as</p>
              <p className="font-semibold text-gray-900 break-all">{email}</p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
