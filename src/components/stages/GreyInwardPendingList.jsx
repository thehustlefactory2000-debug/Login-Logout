import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { buildSearchIndex, filterIndexedRows } from "../../lib/stageSearch";

const GreyInwardPendingList = ({ onCreateNew, onOpenLot, userId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLotIds, setSelectedLotIds] = useState(() => new Set());

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("lots")
        .select(
          "id, lot_no, cloth_type, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_inward!inner(meters, jodis, length, width, quantity, tagge, is_locked, created_at)",
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

  const indexedRows = useMemo(
    () =>
      rows.map((lot) => {
        const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
        return {
          row: lot,
          index: buildSearchIndex({
            lot: lot.lot_no,
            party: lot.party?.name,
            grey_party: lot.grey_party?.name,
            cloth: lot.cloth_type,
            meters: inward?.meters,
            jodis: inward?.jodis,
            length: inward?.length,
            width: inward?.width,
            quantity: inward?.quantity,
            qty: inward?.quantity,
            tagge: inward?.tagge,
          }),
        };
      }),
    [rows],
  );

  const filteredRows = useMemo(() => filterIndexedRows(indexedRows, search), [indexedRows, search]);
  const selectableIds = useMemo(
    () =>
      filteredRows
        .map((lot) => {
          const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
          return inward?.is_locked ? null : lot.id;
        })
        .filter(Boolean),
    [filteredRows],
  );

  useEffect(() => {
    setSelectedLotIds((prev) => {
      if (!prev.size) return prev;
      const next = new Set();
      const allowed = new Set(rows.map((row) => row.id));
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [rows]);

  const toggleSelect = (lotId) => {
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedLotIds(new Set(selectableIds));
  };

  const clearSelection = () => {
    setSelectedLotIds(new Set());
  };

  const sendSelected = async () => {
    if (!selectedLotIds.size) return;
    if (!userId) {
      setBulkError("User not ready. Please refresh and try again.");
      return;
    }
    const confirmSend = window.confirm(
      `Send ${selectedLotIds.size} selected lots to Checking? This will lock them from editing.`,
    );
    if (!confirmSend) return;

    setBulkSending(true);
    setBulkError("");
    setBulkSuccess("");

    const ids = Array.from(selectedLotIds);
    let successCount = 0;
    const failed = [];

    for (const lotId of ids) {
      const { error: rpcError } = await supabase.rpc("send_grey_inward_to_checking", {
        p_lot_id: lotId,
        p_done_by: userId,
      });
      if (rpcError) {
        failed.push(rpcError.message || `Failed to send lot ${lotId}`);
      } else {
        successCount += 1;
      }
    }

    if (successCount) {
      setBulkSuccess(`${successCount} lot${successCount === 1 ? "" : "s"} sent to Checking.`);
    }
    if (failed.length) {
      setBulkError(`Failed for ${failed.length} lot${failed.length === 1 ? "" : "s"}: ${failed.join(" | ")}`);
    }

    clearSelection();
    await loadRows();
    setBulkSending(false);
  };

  return (
    <div className="glass-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl surface-title">Grey Inward Dashboard</h2>
        <button
          type="button"
          onClick={onCreateNew}
          className="btn-primary"
        >
          Create New Lot Entry
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {bulkError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{bulkError}</div>}
      {bulkSuccess && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{bulkSuccess}</div>}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search (e.g. lot:120, party:ram, qty:500)"
          className="w-full sm:max-w-md px-3 py-2 rounded-xl glass-input outline-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            className="btn-secondary btn-sm disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={!selectableIds.length}
            className="btn-secondary btn-sm disabled:opacity-60"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={!selectedLotIds.size}
            className="btn-secondary btn-sm disabled:opacity-60"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={sendSelected}
            disabled={!selectedLotIds.size || bulkSending}
            className="btn-dark btn-sm disabled:opacity-60"
          >
            {bulkSending ? "Sending..." : `Send Selected (${selectedLotIds.size})`}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading pending lots...</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-gray-600">No saved lots are pending in Grey Inward stage.</p>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((lot) => {
            const inward = Array.isArray(lot.grey_inward) ? lot.grey_inward[0] : lot.grey_inward;
            const isLocked = Boolean(inward?.is_locked);
            const isSelected = selectedLotIds.has(lot.id);
            return (
              <div key={lot.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(lot.id)}
                      disabled={isLocked}
                      className="h-4 w-4"
                    />
                    <p className="font-semibold text-gray-900">Lot #{lot.lot_no}</p>
                  </label>
                  <button
                    type="button"
                    onClick={() => onOpenLot?.(lot.id)}
                    className="btn-dark btn-sm"
                  >
                    Open
                  </button>
                </div>
                <p>Party: {lot.party?.name || "-"}</p>
                <p>Grey Party: {lot.grey_party?.name || "-"}</p>
                <p>Cloth: {lot.cloth_type || "-"}</p>
                <p>Meters: {inward?.meters ?? "-"}</p>
                <p>Jodis: {inward?.jodis ?? "-"}</p>
                <p>Length: {inward?.length ?? "-"}</p>
                <p>Width: {inward?.width ?? "-"}</p>
                <p>Quantity: {inward?.quantity || "-"}</p>
                <p>Tagge: {inward?.tagge ?? "-"}</p>
                <p className="text-gray-500">
                  Status: {isLocked ? "Locked (already sent)" : "Saved, not promoted"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GreyInwardPendingList;





