import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { STAGE_FORM_CONFIG, STAGE_LABELS } from "../constants/workflow";
import StageEntryForm from "../components/stages/StageEntryForm";
import GreyInwardEntryForm from "../components/stages/GreyInwardEntryForm";
import GreyInwardPendingList from "../components/stages/GreyInwardPendingList";
import CheckingStagePanel from "../components/stages/CheckingStagePanel";
import BleachingStagePanel from "../components/stages/BleachingStagePanel";
import DyeingStagePanel from "../components/stages/DyeingStagePanel";
import StenterStagePanel from "../components/stages/StenterStagePanel";
import FinishingStagePanel from "../components/stages/FinishingStagePanel";
import FoldingStagePanel from "../components/stages/FoldingStagePanel";

const Dashboard = () => {
  const [error, setError] = useState("");
  const [greyInwardMode, setGreyInwardMode] = useState("list");
  const [selectedGreyLotId, setSelectedGreyLotId] = useState(null);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="glass-card p-4 sm:p-6">
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
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg"
            >
              Sign Out
            </button>
          </div>
        </div>

        {profile?.assignedStage === "grey_inward" && greyInwardMode === "list" && (
          <GreyInwardPendingList
            onCreateNew={() => {
              setSelectedGreyLotId(null);
              setGreyInwardMode("entry");
            }}
            onOpenLot={(lotId) => {
              setSelectedGreyLotId(lotId);
              setGreyInwardMode("entry");
            }}
          />
        )}

        {profile?.assignedStage === "grey_inward" && greyInwardMode === "entry" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setGreyInwardMode("list")}
              className="px-4 py-2 rounded-xl bg-white/80 border border-gray-300 text-sm"
            >
              Back To Grey Inward Dashboard
            </button>
            <GreyInwardEntryForm
              userId={user?.id}
              initialLotId={selectedGreyLotId}
              onSent={() => setGreyInwardMode("list")}
            />
          </div>
        )}

        {profile?.assignedStage === "checking" && (
          <CheckingStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage === "bleaching" && (
          <BleachingStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage === "dyeing" && (
          <DyeingStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage === "stenter" && (
          <StenterStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage === "finishing" && (
          <FinishingStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage === "folding" && (
          <FoldingStagePanel userId={user?.id} />
        )}

        {profile?.assignedStage && profile.assignedStage !== "grey_inward" && profile.assignedStage !== "checking" && profile.assignedStage !== "bleaching" && profile.assignedStage !== "dyeing" && profile.assignedStage !== "stenter" && profile.assignedStage !== "finishing" && profile.assignedStage !== "folding" && STAGE_FORM_CONFIG[profile.assignedStage] && (
          <StageEntryForm config={STAGE_FORM_CONFIG[profile.assignedStage]} userId={user?.id} />
        )}

        {!profile?.assignedStage && (
          <div className="glass-card p-4 sm:p-6 text-sm text-gray-700">
            No stage assigned yet. Ask admin to assign your stage from Admin Panel.
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

