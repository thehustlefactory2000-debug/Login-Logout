import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const GreyInwardPendingList = ({ onCreateNew, onOpenLot }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("lots")
        .select(
          "id, lot_no, cloth_type, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, tagge, is_locked, created_at)",
        )
        .eq("current_stage", "grey_inward")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (fetchError) throw fetchError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load inward lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();

    const channel = supabase
      .channel("realtime-grey-inward-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadRows)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_inward" }, loadRows)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="glass-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Grey Inward Dashboard</h2>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg"
        >
          Create New Lot Entry
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={loadRows}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-sm disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading pending lots...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">No saved lots are pending in Grey Inward stage.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((lot) => {
            const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
            return (
              <div key={lot.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                  <button
                    type="button"
                    onClick={() => onOpenLot?.(lot.id)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-xs font-semibold shadow"
                  >
                    Open
                  </button>
                </div>
                <p>Party: {lot.party?.name || "-"}</p>
                <p>Grey Party: {lot.grey_party?.name || "-"}</p>
                <p>Cloth: {lot.cloth_type || "-"}</p>
                <p>Meters: {inward?.meters ?? "-"}</p>
                <p>Jodis: {inward?.jodis ?? "-"}</p>
                <p>Tagge: {inward?.tagge ?? "-"}</p>
                <p className="text-gray-500">Status: Saved, not promoted</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GreyInwardPendingList;

