import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { STAGE_FORM_CONFIG, STAGE_LABELS } from "../constants/workflow";
import StageEntryForm from "../components/stages/StageEntryForm";
import GreyInwardEntryForm from "../components/stages/GreyInwardEntryForm";

const Dashboard = () => {
  const [error, setError] = useState("");
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        await refreshProfile();
      } catch (e) {
        setError(e.message || "Failed to load profile.");
      }
    };

    loadProfile();
  }, [refreshProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Staff Dashboard</h1>
          <p className="text-gray-600">Welcome, {profile?.name || profile?.email || "Staff"}.</p>

          {error && <p className="text-red-600 mt-2">{error}</p>}
          {!error && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-500">Assigned Stage</p>
              <p className="font-semibold text-gray-900">
                {STAGE_LABELS[profile?.assignedStage] || "Not assigned"}
              </p>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        {profile?.assignedStage === "grey_inward" && (
          <GreyInwardEntryForm userId={user?.id} />
        )}

        {profile?.assignedStage && profile.assignedStage !== "grey_inward" && STAGE_FORM_CONFIG[profile.assignedStage] && (
          <StageEntryForm config={STAGE_FORM_CONFIG[profile.assignedStage]} userId={user?.id} />
        )}

        {!profile?.assignedStage && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 text-sm text-gray-700">
            No stage assigned yet. Ask admin to assign your stage from Admin Panel.
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
