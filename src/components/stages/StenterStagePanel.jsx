import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";

const StenterStagePanel = ({ userId }) => {
  const [mode, setMode] = useState("list");
  const [rows, setRows] = useState([]);
  const [lotData, setLotData] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [stenteredMeters, setStenteredMeters] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase
        .from("lots")
        .select("id, lot_no, bleaching(bleach_group_no), dyeing(dyed_meters)")
        .eq("current_stage", "stenter")
        .eq("status", "active")
        .order("lot_no", { ascending: false });

      if (listError) throw listError;
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Failed to load stenter lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();

    const channel = supabase
      .channel("realtime-stenter-stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "bleaching" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "dyeing" }, loadList)
      .on("postgres_changes", { event: "*", schema: "public", table: "stenter" }, loadList)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const indexedRows = useMemo(
    () =>
      rows.map((lot) => {
      const bleaching = Array.isArray(lot.bleaching) ? lot.bleaching[0] : lot.bleaching;
      const dyeing = Array.isArray(lot.dyeing) ? lot.dyeing[0] : lot.dyeing;
      const sourceStage = dyeing ? "dyeing" : "bleaching";
        return {
          row: lot,
          index: buildSearchIndex({
            lot: lot.lot_no,
            source: sourceStage,
            bleached: bleaching?.bleach_group_no,
            dyed: dyeing?.dyed_meters,
          }),
        };
      }),
    [rows],
  );

  const filteredRows = useMemo(() => filterIndexedRows(indexedRows, search), [indexedRows, search]);

  const openLot = async (lotId) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("id, lot_no, current_stage, status, bleaching(bleach_group_no), dyeing(dyed_meters)")
        .eq("id", lotId)
        .single();
      if (lotError) throw lotError;
      if (lot.current_stage !== "stenter") {
        throw new Error(`Lot is in ${lot.current_stage} stage, not stenter.`);
      }

      const { data: existing, error: stenterError } = await supabase
        .from("stenter")
        .select("id, stentered_meters, is_locked")
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stenterError) throw stenterError;

      setLotData(lot);
      setRecordId(existing?.id || null);
      setRecordLocked(Boolean(existing?.is_locked));
      setStenteredMeters(existing?.stentered_meters ?? "");
      setMode("form");
    } catch (e) {
      setError(e.message || "Failed to open stenter lot.");
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!lotData?.id) {
      setError("Open a valid lot first.");
      return;
    }
    if (stenteredMeters === "") {
      setError("Stentered meters is required.");
      return;
    }
    if (recordLocked) {
      setError("This stenter record is already sent/locked.");
      return;
    }

    const dyeing = Array.isArray(lotData.dyeing) ? lotData.dyeing[0] : lotData.dyeing;
    const inputMeters = dyeing?.dyed_meters ?? null;

    setSaving(true);
    try {
      if (recordId) {
        const { error: updateError } = await supabase
          .from("stenter")
          .update({
            input_meters: inputMeters,
            stentered_meters: Number(stenteredMeters),
          })
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("stenter")
          .insert({
            lot_id: lotData.id,
            input_meters: inputMeters,
            stentered_meters: Number(stenteredMeters),
            created_by: userId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        setRecordId(inserted.id);
      }

      setSuccess("Stenter data saved. You can now send to folding stage.");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to save stenter data.");
    } finally {
      setSaving(false);
    }
  };

  const sendToFinishing = async () => {
    setError("");
    setSuccess("");

    if (!lotData?.id) {
      setError("Open a lot first.");
      return;
    }

    setSending(true);
    try {
      const { error: rpcError } = await supabase.rpc("send_stenter_to_finishing", {
        p_lot_id: lotData.id,
        p_done_by: userId,
      });
      if (rpcError) throw rpcError;

      setSuccess(`Lot #${lotData.lot_no} sent to finishing stage.`);
      setMode("list");
      setLotData(null);
      setRecordId(null);
      setRecordLocked(false);
      setStenteredMeters("");
      await loadList();
    } catch (e) {
      setError(e.message || "Failed to send lot to finishing.");
    } finally {
      setSending(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl surface-title">Stenter Dashboard</h2>
          <button
            type="button"
            onClick={loadList}
            disabled={loading}
            className="btn-secondary btn-sm disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search (e.g. source:dyeing, bleached:78, dyed:500)"
            className="w-full sm:max-w-md px-3 py-2 rounded-xl glass-input outline-none text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading lots in stenter stage...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-600">No lots are currently in stenter stage.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((lot) => {
              const bleaching = Array.isArray(lot.bleaching) ? lot.bleaching[0] : lot.bleaching;
              const dyeing = Array.isArray(lot.dyeing) ? lot.dyeing[0] : lot.dyeing;
              const sourceStage = dyeing ? "dyeing" : "bleaching";
              return (
                <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                    <button
                      type="button"
                      onClick={() => openLot(lot.id)}
                      className="btn-dark btn-sm"
                    >
                      Open
                    </button>
                  </div>
                  <p>Came From: {sourceStage}</p>
                  <p>Bleached No: {bleaching?.bleach_group_no ?? "-"}</p>
                  {dyeing?.dyed_meters != null && <p>Dyed Meters: {dyeing.dyed_meters}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const bleaching = Array.isArray(lotData?.bleaching) ? lotData.bleaching[0] : lotData?.bleaching;
  const dyeing = Array.isArray(lotData?.dyeing) ? lotData.dyeing[0] : lotData?.dyeing;
  const sourceStage = dyeing ? "dyeing" : "bleaching";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setLotData(null);
          setRecordId(null);
          setRecordLocked(false);
          setStenteredMeters("");
          setError("");
          setSuccess("");
        }}
        className="btn-secondary"
      >
        Back To Stenter Dashboard
      </button>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-xl surface-title mb-2">Stenter Entry</h2>
        <p className="text-sm text-gray-600">Lot No: <span className="font-semibold">{lotData?.lot_no}</span></p>
        <p className="text-sm text-gray-600 mb-4">Came From: <span className="font-semibold">{sourceStage}</span></p>

        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
          <p>Bleached No: <span className="font-medium">{bleaching?.bleach_group_no ?? "-"}</span></p>
          {dyeing?.dyed_meters != null && <p>Dyed Meters: <span className="font-medium">{dyeing.dyed_meters}</span></p>}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}

        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Stentered Meters</span>
            <input
              type="number"
              step="0.01"
              value={stenteredMeters}
              onChange={(e) => setStenteredMeters(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input outline-none"
              disabled={recordLocked || sending}
            />
          </label>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={saving || recordLocked || sending}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={sendToFinishing}
              disabled={sending || recordLocked || !lotData?.id}
              className="btn-dark disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send To Finishing Stage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StenterStagePanel;





