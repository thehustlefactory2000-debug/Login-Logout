import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  AdminShellCard,
  ConfirmDialog,
  FilterLabel,
  MetricCard,
  PanelHeader,
  STAGE_RATE_CONFIG,
  STAGE_RATE_STAGE_OPTIONS,
  buildBillingRows,
  normalizeStageParameter,
  getStatusTone,
  toPrintableDate,
} from "./adminDashboardShared";

const emptyDraftFilters = {
  stage: "",
  parameterValue: "",
  rateSet: "",
  status: "",
  startDate: "",
  endDate: "",
  paidStatus: "",
};

const withinDateRange = (value, startDate, endDate) => {
  if (!value) return false;
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    if (createdAt < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`).getTime();
    if (createdAt > end) return false;
  }
  return true;
};

const matchesRateSet = (row, rateSet) => {
  if (!rateSet) return true;
  const hasMeter = row.meterRate != null;
  const hasTaggas = row.taggasRate != null;
  if (rateSet === "both") return hasMeter && hasTaggas;
  if (rateSet === "meter_only") return hasMeter && !hasTaggas;
  if (rateSet === "taggas_only") return !hasMeter && hasTaggas;
  if (rateSet === "not_set") return !hasMeter && !hasTaggas;
  return true;
};

const AdminBillingPanel = () => {
  const [lots, setLots] = useState([]);
  const [stageRates, setStageRates] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draftFilters, setDraftFilters] = useState(emptyDraftFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyDraftFilters);
  const [error, setError] = useState("");
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [bulkDialog, setBulkDialog] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: lotsData, error: lotsError }, { data: ratesData, error: ratesError }, { data: paymentsData, error: paymentsError }] = await Promise.all([
        supabase
          .from("lots")
          .select(
            "id, lot_no, cloth_type, current_stage, status, created_at, party:party_id(name), grey_party:grey_party_id(name), grey_checking(taggas), bleaching(id, bleach_type, input_meters, output_meters, is_locked), masrise(id, input_meters, completed_meters, is_locked), dyeing(id, input_meters, dyed_meters, is_locked), stenter(id, input_meters, stentered_meters, stenter_type, is_locked), finishing(id, input_meters, finished_meters, finishing_type, is_locked), folding(id, input_meters, folding_type, is_locked)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("stage_rates").select("id, stage, parameter_value, meter_rate, taggas_rate, is_active"),
        supabase.from("stage_payments").select("id, lot_id, stage, parameter_value, paid_unit, processed_meters, taggas, meter_rate, taggas_rate, paid_amount, paid_at, paid_by"),
      ]);

      if (lotsError) throw lotsError;
      if (ratesError) throw ratesError;
      if (paymentsError) throw paymentsError;

      setLots(lotsData || []);
      setStageRates(ratesData || []);
      setPayments(paymentsData || []);
    } catch (e) {
      setError(e.message || "Failed to load billing data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime-admin-billing")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "grey_checking" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "bleaching" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "masrise" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "dyeing" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "stenter" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "finishing" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "folding" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_rates" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_payments" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const allRows = useMemo(() => buildBillingRows(lots, stageRates, payments), [lots, stageRates, payments]);

  const lotPaidMap = useMemo(() => {
    const map = new Map();
    for (const row of allRows) {
      if (!map.has(row.lotId)) {
        map.set(row.lotId, { total: 0, paid: 0 });
      }
      const entry = map.get(row.lotId);
      entry.total += 1;
      if (row.paid) entry.paid += 1;
    }
    const result = new Map();
    for (const [lotId, stats] of map.entries()) {
      result.set(lotId, stats.total > 0 && stats.total === stats.paid);
    }
    return result;
  }, [allRows]);

  const parameterOptions = useMemo(() => {
    const stage = draftFilters.stage;
    if (!stage) return [];
    const seen = new Map();
    for (const row of allRows.filter((item) => item.stage === stage)) {
      if (!seen.has(row.parameterValue)) {
        seen.set(row.parameterValue, { value: row.parameterValue, label: row.parameterLabel });
      }
    }
    return [...seen.values()];
  }, [allRows, draftFilters.stage]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (appliedFilters.stage && row.stage !== appliedFilters.stage) return false;
      if (appliedFilters.parameterValue && row.parameterValue !== appliedFilters.parameterValue) return false;
      if (!matchesRateSet(row, appliedFilters.rateSet)) return false;
      if (appliedFilters.status && row.status !== appliedFilters.status) return false;
      if (appliedFilters.paidStatus === "paid" && !row.paid) return false;
      if (appliedFilters.paidStatus === "unpaid" && row.paid) return false;
      if ((appliedFilters.startDate || appliedFilters.endDate) && !withinDateRange(row.createdAt, appliedFilters.startDate, appliedFilters.endDate)) return false;
      return true;
    });
  }, [allRows, appliedFilters]);

  const totals = useMemo(() => {
    const totalProcessedMeters = filteredRows.reduce((sum, row) => sum + row.processedMeters, 0);
    const totalTaggas = filteredRows.reduce((sum, row) => sum + row.taggas, 0);
    const totalMeterAmount = filteredRows.reduce((sum, row) => sum + row.meterAmount, 0);
    const totalTaggasAmount = filteredRows.reduce((sum, row) => sum + row.taggasAmount, 0);
    const paidRows = filteredRows.filter((row) => row.paid).length;
    const totalPaidAmount = filteredRows.reduce((sum, row) => sum + (row.paid ? row.paidAmount : 0), 0);
    const lotSeen = new Set();
    let paidLots = 0;
    for (const row of filteredRows) {
      if (lotSeen.has(row.lotId)) continue;
      lotSeen.add(row.lotId);
      if (lotPaidMap.get(row.lotId)) paidLots += 1;
    }
    return { totalProcessedMeters, totalTaggas, totalMeterAmount, totalTaggasAmount, paidRows, paidLots, totalPaidAmount };
  }, [filteredRows, lotPaidMap]);

  const selectedRows = useMemo(() => filteredRows.filter((row) => selectedRowIds.has(row.id)), [filteredRows, selectedRowIds]);

  const selectedInViewCount = useMemo(() => {
    let count = 0;
    for (const row of filteredRows) {
      if (selectedRowIds.has(row.id)) count += 1;
    }
    return count;
  }, [filteredRows, selectedRowIds]);

  const setDraftField = (key, value) => {
    setDraftFilters((prev) => {
      if (key === "stage") return { ...prev, stage: value, parameterValue: "" };
      return { ...prev, [key]: value };
    });
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setSelectedRowIds(new Set());
  };

  const toggleSelectRow = (rowId) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedRowIds((prev) => {
      if (selectedInViewCount === filteredRows.length) return new Set();
      return new Set(filteredRows.map((row) => row.id));
    });
  };

  const openPayDialog = (row, unit) => setPaymentDialog({ type: "pay", row, unit });
  const openClearDialog = (row) => setPaymentDialog({ type: "clear", row });
  const closePaymentDialog = () => setPaymentDialog(null);

  const openBulkDialog = (rows, mode, unit, label) => {
    setBulkDialog({ rows, mode, unit, label });
  };
  const closeBulkDialog = () => setBulkDialog(null);

  const getPayableRows = (rows, unit) =>
    rows.filter((row) => {
      const amount = unit === "meters" ? row.meterAmount : row.taggasAmount;
      const rateOk = unit === "meters" ? row.meterRate != null : row.taggasRate != null;
      return !row.paid && rateOk && amount > 0;
    });

  const getAutoPayItems = (rows) =>
    rows
      .filter((row) => !row.paid)
      .map((row) => {
        if (row.meterRate != null && row.meterAmount > 0) {
          return { row, unit: "meters", amount: row.meterAmount };
        }
        if (row.taggasRate != null && row.taggasAmount > 0) {
          return { row, unit: "taggas", amount: row.taggasAmount };
        }
        return null;
      })
      .filter(Boolean);

  const buildBulkItems = (rows, mode, unit) => {
    if (mode === "auto") return getAutoPayItems(rows);
    return getPayableRows(rows, unit).map((row) => ({
      row,
      unit,
      amount: unit === "meters" ? row.meterAmount : row.taggasAmount,
    }));
  };

  const bulkTotal = (items) => items.reduce((sum, item) => sum + item.amount, 0);

  const handlePaymentConfirm = async () => {
    if (!paymentDialog) return;
    setPaymentBusy(true);
    setError("");
    try {
      const row = paymentDialog.row;
      if (paymentDialog.type === "pay") {
        const unit = paymentDialog.unit;
        const amount = unit === "meters" ? row.meterAmount : row.taggasAmount;
        if (!amount || amount <= 0) throw new Error("No payable amount for this unit.");
        const parameterValue = normalizeStageParameter(row.parameterValue);
        const { data: existing, error: existingError } = await supabase
          .from("stage_payments")
          .select("id")
          .eq("lot_id", row.lotId)
          .eq("stage", row.stage)
          .eq("parameter_value", parameterValue)
          .maybeSingle();

        if (existingError && existingError.code !== "PGRST116") throw existingError;

        const payload = {
          lot_id: row.lotId,
          stage: row.stage,
          parameter_value: parameterValue,
          paid_unit: unit,
          processed_meters: row.processedMeters,
          taggas: row.taggas,
          meter_rate: row.meterRate,
          taggas_rate: row.taggasRate,
          paid_amount: amount,
          paid_at: new Date().toISOString(),
        };

        if (existing?.id) {
          const { error } = await supabase.from("stage_payments").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("stage_payments").insert(payload);
          if (error) throw error;
        }
      } else if (paymentDialog.type === "clear") {
        if (row.payment?.id) {
          const { error } = await supabase.from("stage_payments").delete().eq("id", row.payment.id);
          if (error) throw error;
        }
      }

      setPaymentDialog(null);
      loadData();
    } catch (e) {
      setError(e.message || "Failed to update payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (!bulkDialog) return;
    setPaymentBusy(true);
    setError("");
    try {
      const items = buildBulkItems(bulkDialog.rows, bulkDialog.mode, bulkDialog.unit);
      if (items.length === 0) throw new Error("No payable rows found for this action.");

      const payloads = items.map((item) => ({
        lot_id: item.row.lotId,
        stage: item.row.stage,
        parameter_value: normalizeStageParameter(item.row.parameterValue),
        paid_unit: item.unit,
        processed_meters: item.row.processedMeters,
        taggas: item.row.taggas,
        meter_rate: item.row.meterRate,
        taggas_rate: item.row.taggasRate,
        paid_amount: item.amount,
        paid_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("stage_payments")
        .upsert(payloads, { onConflict: "lot_id,stage,parameter_value" });
      if (error) throw error;

      setBulkDialog(null);
      setSelectedRowIds(new Set());
      loadData();
    } catch (e) {
      setError(e.message || "Failed to update payments.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const bulkSelectedMeter = getPayableRows(selectedRows, "meters");
  const bulkSelectedTaggas = getPayableRows(selectedRows, "taggas");
  const bulkFilteredMeter = getPayableRows(filteredRows, "meters");
  const bulkFilteredTaggas = getPayableRows(filteredRows, "taggas");
  const bulkSelectedAuto = getAutoPayItems(selectedRows);
  const bulkFilteredAuto = getAutoPayItems(filteredRows);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <AdminShellCard>
        <PanelHeader
          eyebrow="Billing Filters"
          title="Processed stage billing"
          description="Filter processed stage rows by stage, parameter, rate setup, status, and created date. Both meter and taggas calculations are shown together."
          action={<button type="button" onClick={loadData} className="btn-secondary">Refresh</button>}
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
          <FilterLabel label="Stage">
            <select value={draftFilters.stage} onChange={(e) => setDraftField("stage", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
              <option value="">All stages</option>
              {STAGE_RATE_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterLabel>

          <FilterLabel label={draftFilters.stage ? STAGE_RATE_CONFIG[draftFilters.stage]?.parameterLabel || "Parameter" : "Parameter"}>
            <select value={draftFilters.parameterValue} onChange={(e) => setDraftField("parameterValue", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none" disabled={!draftFilters.stage || parameterOptions.length === 0}>
              <option value="">All parameters</option>
              {parameterOptions.map((option) => (
                <option key={option.value || "standard"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterLabel>

          <FilterLabel label="Rate Set">
            <select value={draftFilters.rateSet} onChange={(e) => setDraftField("rateSet", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
              <option value="">All rows</option>
              <option value="both">Both rates set</option>
              <option value="meter_only">Only meter rate</option>
              <option value="taggas_only">Only taggas rate</option>
              <option value="not_set">No rate set</option>
            </select>
          </FilterLabel>

          <FilterLabel label="Status">
            <select value={draftFilters.status} onChange={(e) => setDraftField("status", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
              <option value="">All status</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </FilterLabel>

          <FilterLabel label="Paid Status">
            <select value={draftFilters.paidStatus} onChange={(e) => setDraftField("paidStatus", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
              <option value="">All payments</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </FilterLabel>

          <FilterLabel label="Start Date">
            <input type="date" value={draftFilters.startDate} onChange={(e) => setDraftField("startDate", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none" />
          </FilterLabel>

          <FilterLabel label="End Date">
            <input type="date" value={draftFilters.endDate} onChange={(e) => setDraftField("endDate", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none" />
          </FilterLabel>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-4 sm:px-6">
          <button type="button" onClick={applyFilters} className="btn-primary">
            Show Billing
          </button>
          <button type="button" onClick={() => { setDraftFilters(emptyDraftFilters); setAppliedFilters(emptyDraftFilters); setSelectedRowIds(new Set()); }} className="btn-secondary">
            Reset
          </button>
        </div>
      </AdminShellCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Rows" value={filteredRows.length} tone="slate" />
        <MetricCard label="Processed Meters" value={totals.totalProcessedMeters.toFixed(2)} tone="blue" />
        <MetricCard label="Total Taggas" value={totals.totalTaggas.toFixed(2)} tone="amber" />
        <MetricCard label="Meter Amount / Taggas Amount" value={`${totals.totalMeterAmount.toFixed(2)} / ${totals.totalTaggasAmount.toFixed(2)}`} tone="emerald" />
        <MetricCard label="Paid Lots" value={totals.paidLots} tone="blue" />
        <MetricCard label="Paid Rows" value={totals.paidRows} tone="blue" />
        <MetricCard label="Paid Amount" value={totals.totalPaidAmount.toFixed(2)} tone="amber" />
      </div>

      <AdminShellCard>
        <PanelHeader
          eyebrow="Billing Result"
          title="Calculated payable rows"
          description="Each row shows both billing calculations so you can decide whether to pay by meters or by taggas for that stage."
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-6">
          <span>Selected: {selectedInViewCount}</span>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkSelectedAuto.length === 0}
            onClick={() => openBulkDialog(selectedRows, "auto", null, "selected")}
          >
            Pay selected (auto) ({bulkSelectedAuto.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkSelectedMeter.length === 0}
            onClick={() => openBulkDialog(selectedRows, "unit", "meters", "selected")}
          >
            Pay selected by meter ({bulkSelectedMeter.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkSelectedTaggas.length === 0}
            onClick={() => openBulkDialog(selectedRows, "unit", "taggas", "selected")}
          >
            Pay selected by taggas ({bulkSelectedTaggas.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkFilteredAuto.length === 0}
            onClick={() => openBulkDialog(filteredRows, "auto", null, "filtered")}
          >
            Pay filtered (auto) ({bulkFilteredAuto.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkFilteredMeter.length === 0}
            onClick={() => openBulkDialog(filteredRows, "unit", "meters", "filtered")}
          >
            Pay filtered by meter ({bulkFilteredMeter.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={paymentBusy || bulkFilteredTaggas.length === 0}
            onClick={() => openBulkDialog(filteredRows, "unit", "taggas", "filtered")}
          >
            Pay filtered by taggas ({bulkFilteredTaggas.length})
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading billing rows...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">No billing rows match the selected filters.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedInViewCount === filteredRows.length}
                      onChange={toggleSelectAllFiltered}
                    />
                    <span>Select all</span>
                  </label>
                  <span>Selected: {selectedInViewCount}</span>
                </div>

                {filteredRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.has(row.id)}
                          onChange={() => toggleSelectRow(row.id)}
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">#{row.lotNo}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.stageLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.partyName}</div>
                        </div>
                      </label>
                      <span className={`status-pill ${getStatusTone(row.status)}`}>{row.status}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{toPrintableDate(row.createdAt)}</span>
                      <span className="text-slate-300">•</span>
                      {lotPaidMap.get(row.lotId) ? (
                        <span className="status-pill success">Lot paid</span>
                      ) : (
                        <span className="status-pill warn">Lot unpaid</span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Parameter</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.parameterLabel}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Processed Meters</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.processedMeters.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Taggas</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.taggas.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rate Status</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.rateStatus.replaceAll("_", " ")}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Meter Rate</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.meterRate == null ? "-" : row.meterRate.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Meter Amount</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.meterAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Taggas Rate</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.taggasRate == null ? "-" : row.taggasRate.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Taggas Amount</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.taggasAmount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {row.paid ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-emerald-700">Paid</div>
                          <div className="text-xs text-slate-500">{row.paidUnit} {row.paidAmount.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">{toPrintableDate(row.paidAt)}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Unpaid</div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={paymentBusy || row.meterRate == null || row.processedMeters <= 0}
                        onClick={() => openPayDialog(row, "meters")}
                      >
                        Pay meter
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={paymentBusy || row.taggasRate == null || row.taggas <= 0}
                        onClick={() => openPayDialog(row, "taggas")}
                      >
                        Pay taggas
                      </button>
                      {row.paid ? (
                        <button
                          type="button"
                          className="btn-danger"
                          disabled={paymentBusy}
                          onClick={() => openClearDialog(row)}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                      <th className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={filteredRows.length > 0 && selectedInViewCount === filteredRows.length}
                          onChange={toggleSelectAllFiltered}
                        />
                      </th>
                      <th className="py-3 pr-3">Lot</th>
                      <th className="py-3 pr-3">Lot Paid</th>
                      <th className="py-3 pr-3">Date</th>
                      <th className="py-3 pr-3">Stage</th>
                      <th className="py-3 pr-3">Parameter</th>
                      <th className="py-3 pr-3">Status</th>
                      <th className="py-3 pr-3">Processed Meters</th>
                      <th className="py-3 pr-3">Taggas</th>
                      <th className="py-3 pr-3">Meter Rate</th>
                      <th className="py-3 pr-3">Meter Amount</th>
                      <th className="py-3 pr-3">Taggas Rate</th>
                      <th className="py-3 pr-3">Taggas Amount</th>
                      <th className="py-3 pr-3">Paid</th>
                      <th className="py-3 pr-0">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-4 pr-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(row.id)}
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </td>
                        <td className="py-4 pr-3">
                          <div className="font-semibold text-slate-900">#{row.lotNo}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.stageLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.partyName}</div>
                        </td>
                        <td className="py-4 pr-3">
                          {lotPaidMap.get(row.lotId) ? (
                            <span className="status-pill success">Paid</span>
                          ) : (
                            <span className="status-pill warn">Unpaid</span>
                          )}
                        </td>
                        <td className="py-4 pr-3 text-xs text-slate-500">{toPrintableDate(row.createdAt)}</td>
                        <td className="py-4 pr-3">{row.stageLabel}</td>
                        <td className="py-4 pr-3">{row.parameterLabel}</td>
                        <td className="py-4 pr-3">
                          <span className={`status-pill ${getStatusTone(row.status)}`}>{row.status}</span>
                        </td>
                        <td className="py-4 pr-3 font-medium text-slate-900">{row.processedMeters.toFixed(2)}</td>
                        <td className="py-4 pr-3 font-medium text-slate-900">{row.taggas.toFixed(2)}</td>
                        <td className="py-4 pr-3">
                          <div className="font-medium text-slate-900">{row.meterRate == null ? "-" : row.meterRate.toFixed(2)}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.rateStatus.replaceAll("_", " ")}</div>
                        </td>
                        <td className="py-4 pr-3 font-semibold text-slate-900">{row.meterAmount.toFixed(2)}</td>
                        <td className="py-4 pr-3">{row.taggasRate == null ? "-" : row.taggasRate.toFixed(2)}</td>
                        <td className="py-4 pr-3 font-semibold text-slate-900">{row.taggasAmount.toFixed(2)}</td>
                        <td className="py-4 pr-3">
                          {row.paid ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-emerald-700">Paid</div>
                              <div className="text-xs text-slate-500">{row.paidUnit} {row.paidAmount.toFixed(2)}</div>
                              <div className="text-xs text-slate-500">{toPrintableDate(row.paidAt)}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">Unpaid</div>
                          )}
                        </td>
                        <td className="py-4 pr-0">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={paymentBusy || row.meterRate == null || row.processedMeters <= 0}
                              onClick={() => openPayDialog(row, "meters")}
                            >
                              Pay meter
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={paymentBusy || row.taggasRate == null || row.taggas <= 0}
                              onClick={() => openPayDialog(row, "taggas")}
                            >
                              Pay taggas
                            </button>
                            {row.paid ? (
                              <button
                                type="button"
                                className="btn-danger"
                                disabled={paymentBusy}
                                onClick={() => openClearDialog(row)}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </AdminShellCard>

      {paymentDialog ? (
        <ConfirmDialog
          title={paymentDialog.type === "pay" ? "Confirm payment" : "Clear payment"}
          description={
            paymentDialog.type === "pay"
              ? `Mark lot #${paymentDialog.row.lotNo} ${paymentDialog.row.stageLabel} as paid by ${paymentDialog.unit}? Amount: ${(
                  paymentDialog.unit === "meters" ? paymentDialog.row.meterAmount : paymentDialog.row.taggasAmount
                ).toFixed(2)}.`
              : `Clear payment for lot #${paymentDialog.row.lotNo} ${paymentDialog.row.stageLabel}.`
          }
          hint={paymentDialog.type === "pay" ? "This will update the payment record for this stage." : "This will remove the payment record."}
          onCancel={closePaymentDialog}
          onConfirm={handlePaymentConfirm}
          confirmLabel={paymentDialog.type === "pay" ? "Mark paid" : "Clear payment"}
          busy={paymentBusy}
          danger={paymentDialog.type === "clear"}
        />
      ) : null}

      {bulkDialog ? (
        <ConfirmDialog
          title="Confirm bulk payment"
          description={`Pay ${buildBulkItems(bulkDialog.rows, bulkDialog.mode, bulkDialog.unit).length} ${bulkDialog.label} rows${bulkDialog.mode === "auto" ? " (auto)" : ` by ${bulkDialog.unit}`}. Total: ${bulkTotal(buildBulkItems(bulkDialog.rows, bulkDialog.mode, bulkDialog.unit)).toFixed(2)}.`}
          hint="This will upsert payment records for all payable rows."
          onCancel={closeBulkDialog}
          onConfirm={handleBulkConfirm}
          confirmLabel="Mark paid"
          busy={paymentBusy}
        />
      ) : null}
    </div>
  );
};

export default AdminBillingPanel;






