import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { STAGE_OPTIONS } from "../constants/workflow";

const ROLE_OPTIONS = ["admin", "staff"];

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { profile } = useAuth();
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, name, role, assigned_stage, created_at")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message || "Failed to load users.");
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateField = (id, key, value) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [key]: value } : u)));
  };

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError("");
    setSuccess("");

    const payload = {
      role: user.role,
      assigned_stage: user.assigned_stage || null,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message || "Failed to update profile.");
    } else {
      setSuccess("Profile updated.");
    }
    setSavingId("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-600 mt-1">
            Signed in as {profile?.email}
          </p>
          <div className="mt-4">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <div className="space-y-3">
          {loading && <div className="text-gray-600">Loading users...</div>}
          {!loading && users.length === 0 && <div className="text-gray-600">No users found.</div>}

          {!loading && users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="mb-3">
                <p className="font-semibold text-gray-900 break-all">{u.name || u.email}</p>
                <p className="text-sm text-gray-600 break-all">{u.email}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block mb-1 text-gray-700">Role</span>
                  <select
                    value={u.role || "staff"}
                    onChange={(e) => updateField(u.id, "role", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="block mb-1 text-gray-700">Assigned Stage</span>
                  <select
                    value={u.assigned_stage || ""}
                    onChange={(e) => updateField(u.id, "assigned_stage", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                onClick={() => saveUser(u)}
                disabled={savingId === u.id}
                className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-60"
              >
                {savingId === u.id ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
