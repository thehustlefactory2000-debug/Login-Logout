import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const prettyJson = (value) => JSON.stringify(value, null, 2);

const WhatsAppTestPanel = () => {
  const [to, setTo] = useState("whatsapp:+91");
  const [contentSid, setContentSid] = useState("");
  const [contentVariables, setContentVariables] = useState(prettyJson({ 1: "Test" }));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [responseBody, setResponseBody] = useState("");

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
      const payload = {
        to: to.trim(),
        contentSid: contentSid.trim(),
        contentVariables: JSON.stringify(parsedVariables),
      };

      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp", {
        body: payload,
      });

      if (invokeError) throw invokeError;

      setSuccess("WhatsApp request sent.");
      setResponseBody(prettyJson(data ?? {}));
    } catch (err) {
      setError(err.message || "Failed to send WhatsApp message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp Test</h2>
      <p className="text-sm text-gray-600 mb-4">
        Sends a template message through the Supabase Edge Function `whatsapp`.
      </p>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={sendMessage} className="grid grid-cols-1 gap-3">
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
            value={contentVariables}
            onChange={(e) => setContentVariables(e.target.value)}
            rows={8}
            className="w-full rounded-xl glass-input px-3 py-2 font-mono text-sm outline-none"
            placeholder={'{\n  "1": "Tanmay"\n}'}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send WhatsApp"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTo("whatsapp:+91");
              setContentSid("");
              setContentVariables(prettyJson({ 1: "Test" }));
              setError("");
              setSuccess("");
              setResponseBody("");
            }}
            className="rounded-xl border border-gray-300 bg-white/80 px-4 py-2 text-sm"
          >
            Reset
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

export default WhatsAppTestPanel;
