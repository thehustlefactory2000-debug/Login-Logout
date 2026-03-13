import React, { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const prettyJson = (value) => JSON.stringify(value, null, 2);
const one = (v) => (Array.isArray(v) ? v[0] : v) || null;

const stageLabel = (stage) => stage || "-";

const buildFilterSummary = (filters) => {
  const parts = [];
  if (filters.lotNo.trim()) parts.push(`Lot ${filters.lotNo.trim()}`);
  if (filters.stage) parts.push(`Stage ${filters.stage}`);
  if (filters.status) parts.push(`Status ${filters.status}`);
  if (filters.clothType.trim()) parts.push(`Cloth ${filters.clothType.trim()}`);
  if (filters.partyName.trim()) parts.push(`Party ${filters.partyName.trim()}`);
  if (filters.greyPartyName.trim()) parts.push(`Grey Party ${filters.greyPartyName.trim()}`);
  if (filters.startDate) parts.push(`From ${filters.startDate}`);
  if (filters.endDate) parts.push(`To ${filters.endDate}`);
  return parts.join(", ") || "All lots";
};

const buildReportLines = (lots, getProcessedMeters) =>
  lots
    .slice(0, 15)
    .map((lot) => {
      const checking = one(lot.grey_checking);
      return [
        `#${lot.lot_no}`,
        stageLabel(lot.current_stage),
        lot.status,
        lot.party?.name || "-",
        lot.cloth_type || "-",
        `Mtr ${getProcessedMeters(lot).toFixed(2)}`,
        `Chk ${checking?.checked_meters ?? "-"}`,
      ].join(" | ");
    })
    .join("\n");

const WhatsAppReportPanel = ({ lots, stats, filters, getProcessedMeters }) => {
  const [to, setTo] = useState("whatsapp:+91");
  const [contentSid, setContentSid] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [responseBody, setResponseBody] = useState("");

  const defaultVariables = useMemo(
    () => ({
      1: new Date().toLocaleDateString(),
      2: String(stats.totalLots),
      3: String(stats.activeLots),
      4: String(stats.completedLots),
      5: String(stats.cancelledLots),
      6: stats.totalProcessedMeters.toFixed(2),
      7: buildFilterSummary(filters),
      8: buildReportLines(lots, getProcessedMeters) || "No lots found.",
    }),
    [filters, getProcessedMeters, lots, stats],
  );

  const [contentVariables, setContentVariables] = useState(prettyJson(defaultVariables));

  React.useEffect(() => {
    setContentVariables(prettyJson(defaultVariables));
  }, [defaultVariables]);

  const sendMessage = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setResponseBody("");

    let parsedVariables = {};
    try {
      parsedVariables = contentVariables.trim() ? JSON.parse(contentVariables) : {};
    } catch {
      setError("Content Variables must be valid JSON.");
      return;
    }

    if (!to.trim() || !contentSid.trim()) {
      setError("To and Content SID are required.");
      return;
    }

    setSending(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp", {
        body: {
          to: to.trim(),
          contentSid: contentSid.trim(),
          contentVariables: JSON.stringify(parsedVariables),
        },
      });

      if (invokeError) throw invokeError;

      setSuccess("WhatsApp report sent.");
      setResponseBody(prettyJson(data ?? {}));
    } catch (err) {
      setError(err.message || "Failed to send WhatsApp report.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-gray-900">Send Report To WhatsApp</h3>
      <p className="mt-1 text-sm text-gray-600">
        Uses the currently filtered lot status data. Variable `8` contains up to 15 lot lines.
      </p>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={sendMessage} className="mt-4 grid grid-cols-1 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">To</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="whatsapp:+919876543210"
            className="w-full rounded-xl glass-input px-3 py-2 outline-none"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Content SID</span>
          <input
            type="text"
            value={contentSid}
            onChange={(e) => setContentSid(e.target.value)}
            placeholder="HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            className="w-full rounded-xl glass-input px-3 py-2 outline-none"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Content Variables JSON</span>
          <textarea
            rows={12}
            value={contentVariables}
            onChange={(e) => setContentVariables(e.target.value)}
            className="w-full rounded-xl glass-input px-3 py-2 font-mono text-sm outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending || !lots.length}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Status Report"}
          </button>
          <button
            type="button"
            onClick={() => setContentVariables(prettyJson(defaultVariables))}
            className="rounded-xl border border-gray-300 bg-white/80 px-4 py-2 text-sm"
          >
            Reload Variables
          </button>
        </div>
      </form>

      {responseBody && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-gray-900">Response</p>
          <pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{responseBody}</pre>
        </div>
      )}
    </div>
  );
};

export default WhatsAppReportPanel;
