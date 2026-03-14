import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  AdminShellCard,
  FilterLabel,
  PanelHeader,
  STAGE_RATE_CONFIG,
  STAGE_RATE_STAGE_OPTIONS,
  formatStageParameter,
  normalizeStageParameter,
  stageLabel,
} from "./adminDashboardShared";

const getDefaultStage = () => STAGE_RATE_STAGE_OPTIONS[0]?.value || "bleaching";

const buildForm = (stage = getDefaultStage()) => ({
  id: "",
  stage,
  parameterValue: STAGE_RATE_CONFIG[stage]?.parameterOptions?.[0]?.value || "",
  meterRate: "",
  taggasRate: "",
  isActive: true,
});

const parseOptionalRate = (value) => {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
};

const formatRate = (value) => (value == null ? "-" : Number(value).toFixed(2));

const AdminRatesPanel = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(buildForm());

  const loadRates = async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("stage_rates")
      .select("id, stage, parameter_value, meter_rate, taggas_rate, is_active, created_at")
      .order("stage", { ascending: true })
      .order("parameter_value", { ascending: true });

    if (fetchError) {
      setError(fetchError.message || "Failed to load stage rates.");
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRates();

    const channel = supabase
      .channel("realtime-admin-stage-rates")
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_rates" }, loadRates)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const parameterOptions = useMemo(() => STAGE_RATE_CONFIG[form.stage]?.parameterOptions || [], [form.stage]);

  const resetForm = (stage = form.stage) => {
    setForm(buildForm(stage));
  };

  const setField = (key, value) => {
    setForm((prev) => {
      if (key === "stage") {
        const nextStage = value;
        return {
          id: prev.id,
          stage: nextStage,
          parameterValue: STAGE_RATE_CONFIG[nextStage]?.parameterOptions?.[0]?.value || "",
          meterRate: prev.id ? prev.meterRate : "",
          taggasRate: prev.id ? prev.taggasRate : "",
          isActive: prev.isActive,
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const saveRate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const parameterValue = normalizeStageParameter(form.parameterValue) || null;
    const meterRate = parseOptionalRate(form.meterRate);
    const taggasRate = parseOptionalRate(form.taggasRate);

    if (Number.isNaN(meterRate) || Number.isNaN(taggasRate)) {
      setError("Enter valid non-negative meter and taggas rates.");
      setSaving(false);
      return;
    }

    if (meterRate == null && taggasRate == null) {
      setError("Enter at least one rate.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        stage: form.stage,
        parameter_value: parameterValue,
        meter_rate: meterRate,
        taggas_rate: taggasRate,
        is_active: form.isActive,
      };

      let existing = null;
      if (form.id) {
        existing = { id: form.id };
      } else {
        let query = supabase.from("stage_rates").select("id").eq("stage", form.stage);
        query = parameterValue == null ? query.is("parameter_value", null) : query.eq("parameter_value", parameterValue);
        const { data, error: existingError } = await query.maybeSingle();
        if (existingError) throw existingError;
        existing = data;
      }

      if (existing?.id) {
        const { error: updateError } = await supabase.from("stage_rates").update(payload).eq("id", existing.id);
        if (updateError) throw updateError;
        setSuccess("Stage rates updated.");
      } else {
        const { error: insertError } = await supabase.from("stage_rates").insert(payload);
        if (insertError) throw insertError;
        setSuccess("Stage rates created.");
      }

      resetForm(form.stage);
      await loadRates();
    } catch (e) {
      setError(e.message || "Failed to save stage rates.");
    } finally {
      setSaving(false);
    }
  };

  const editRow = (row) => {
    setError("");
    setSuccess("");
    setForm({
      id: row.id,
      stage: row.stage,
      parameterValue: normalizeStageParameter(row.parameter_value),
      meterRate: row.meter_rate == null ? "" : String(row.meter_rate),
      taggasRate: row.taggas_rate == null ? "" : String(row.taggas_rate),
      isActive: Boolean(row.is_active),
    });
  };

  const deleteRow = async (row) => {
    setDeletingId(row.id);
    setError("");
    setSuccess("");
    try {
      const { error: deleteError } = await supabase.from("stage_rates").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setSuccess("Stage rates deleted.");
      if (form.id === row.id) resetForm(row.stage);
      await loadRates();
    } catch (e) {
      setError(e.message || "Failed to delete stage rates.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <AdminShellCard>
          <PanelHeader
            eyebrow="Rate Form"
            title="Save stage rates"
            description="Store both meter and taggas rates for each stage and parameter combination. Leave either field blank if that mode should not be billed."
          />
          <form onSubmit={saveRate} className="space-y-4 p-4 sm:p-6">
            <FilterLabel label="Stage">
              <select value={form.stage} onChange={(e) => setField("stage", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
                {STAGE_RATE_STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterLabel>

            {parameterOptions.length > 0 ? (
              <FilterLabel label={STAGE_RATE_CONFIG[form.stage]?.parameterLabel || "Parameter"}>
                <select value={form.parameterValue} onChange={(e) => setField("parameterValue", e.target.value)} className="glass-input w-full px-3 py-2 text-sm outline-none">
                  {parameterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterLabel>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">This stage does not need a separate parameter. A single standard rate row will be used.</div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <FilterLabel label="Meter Rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.meterRate}
                  onChange={(e) => setField("meterRate", e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm outline-none"
                  placeholder="Optional meter rate"
                />
              </FilterLabel>

              <FilterLabel label="Taggas Rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taggasRate}
                  onChange={(e) => setField("taggasRate", e.target.value)}
                  className="glass-input w-full px-3 py-2 text-sm outline-none"
                  placeholder="Optional taggas rate"
                />
              </FilterLabel>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} />
              Active rate row
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? "Saving..." : form.id ? "Update Rates" : "Save Rates"}
              </button>
              <button type="button" onClick={() => resetForm(form.stage)} className="btn-secondary">
                Clear
              </button>
            </div>
          </form>
        </AdminShellCard>

        <AdminShellCard>
          <PanelHeader
            eyebrow="Rate List"
            title="Configured stage rates"
            description="Review, edit, or delete the saved dual-rate rows that billing will use."
            action={<button type="button" onClick={loadRates} className="btn-secondary">Refresh</button>}
          />
          <div className="p-4 sm:p-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading rates...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">No stage rates configured yet.</p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stage</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{stageLabel(row.stage)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatStageParameter(row.stage, row.parameter_value)}</p>
                        </div>
                        <span className={`status-pill ${row.is_active ? "success" : "warn"}`}>{row.is_active ? "active" : "inactive"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Meter Rate</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatRate(row.meter_rate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Taggas Rate</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatRate(row.taggas_rate)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => editRow(row)} className="btn-secondary btn-sm">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteRow(row)} disabled={deletingId === row.id} className="btn-danger btn-sm disabled:opacity-60">
                          {deletingId === row.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        <th className="py-3 pr-3">Stage</th>
                        <th className="py-3 pr-3">Parameter</th>
                        <th className="py-3 pr-3">Meter Rate</th>
                        <th className="py-3 pr-3">Taggas Rate</th>
                        <th className="py-3 pr-3">Status</th>
                        <th className="py-3 pr-0">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 text-slate-700">
                          <td className="py-4 pr-3 font-semibold text-slate-900">{stageLabel(row.stage)}</td>
                          <td className="py-4 pr-3">{formatStageParameter(row.stage, row.parameter_value)}</td>
                          <td className="py-4 pr-3">{formatRate(row.meter_rate)}</td>
                          <td className="py-4 pr-3">{formatRate(row.taggas_rate)}</td>
                          <td className="py-4 pr-3">
                            <span className={`status-pill ${row.is_active ? "success" : "warn"}`}>{row.is_active ? "active" : "inactive"}</span>
                          </td>
                          <td className="py-4 pr-0">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => editRow(row)} className="btn-secondary btn-sm">
                                Edit
                              </button>
                              <button type="button" onClick={() => deleteRow(row)} disabled={deletingId === row.id} className="btn-danger btn-sm disabled:opacity-60">
                                {deletingId === row.id ? "Deleting..." : "Delete"}
                              </button>
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
      </div>
    </div>
  );
};

export default AdminRatesPanel;


