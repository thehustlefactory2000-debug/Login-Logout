import React from "react";
import { STAGE_LABELS } from "../../../constants/workflow";

export const ROLE_OPTIONS = ["admin", "staff"];
export const ADMIN_TABS = [
  { key: "roles", label: "Assign Role" },
  { key: "status", label: "Lot Status" },
  { key: "instructions", label: "Lot Instructions" },
  { key: "rates", label: "Stage Rates" },
  { key: "billing", label: "Billing" },
];
export const ADMIN_TAB_SET = new Set(ADMIN_TABS.map((tab) => tab.key));
export const TAB_DETAILS = {
  roles: {
    eyebrow: "Access Control",
    title: "Team roles and stage ownership",
    description: "Assign staff permissions and define which workflow stage each account controls.",
  },
  status: {
    eyebrow: "Operations",
    title: "Lot tracking and exports",
    description: "Filter live lots, inspect progress, and download reports for production review.",
  },
  instructions: {
    eyebrow: "Planning",
    title: "Checking-based stage instructions",
    description: "Set planned downstream stages for checked lots without touching completed work.",
  },
  rates: {
    eyebrow: "Pricing",
    title: "Stage rate master",
    description: "Store both meter and taggas rates for each processing stage and parameter combination.",
  },
  billing: {
    eyebrow: "Accounts",
    title: "Stage billing explorer",
    description: "Filter processed stage rows and calculate payable amounts using both meter and taggas rates.",
  },
};

export const initialFilters = {
  lotNo: "",
  status: "",
  stage: "",
  clothType: "",
  partyName: "",
  greyPartyName: "",
  startDate: "",
  endDate: "",
};

export const PLANNED_STAGE_ORDER = ["bleaching", "masrise", "dyeing", "stenter", "finishing", "folding"];
export const INSTRUCTION_STAGE_CARDS = [
  { key: "bleaching", label: "Bleaching", description: "Bleach type and route." },
  { key: "masrise", label: "Masrise", description: "Masrise instruction and planned input." },
  { key: "dyeing", label: "Dyeing", description: "Show lot in dyeing stage." },
  { key: "stenter", label: "Stenter", description: "Show lot in stenter stage." },
  { key: "finishing", label: "Finishing", description: "Finishing type instruction." },
  { key: "folding", label: "Folding", description: "Folding type instruction." },
];
export const BLEACH_TYPE_OPTIONS = [
  "hand_poly",
  "hand_cotton",
  "power_poly",
  "power_cotton",
  "power_cotton_squeezing",
  "others",
];
export const FINISHING_TYPE_OPTIONS = [
  { value: "cold_felt", label: "Cold Felt" },
  { value: "double_felt", label: "Double Felt" },
  { value: "single_felt", label: "Single Felt" },
  { value: "cold_finish", label: "Cold Finish" },
];
export const FOLDING_TYPE_OPTIONS = [
  { value: "single_fold", label: "Single Fold" },
  { value: "double_fold", label: "Double Fold" },
  { value: "double_fold_checking", label: "Double Fold + Checking" },
  { value: "single_fold_cutting", label: "Single Fold + Cutting" },
];

const STAGE_RATE_OPTION_MAP = {
  bleaching: BLEACH_TYPE_OPTIONS.map((value) => ({ value, label: value })),
  finishing: FINISHING_TYPE_OPTIONS,
  folding: FOLDING_TYPE_OPTIONS,
};

export const STAGE_RATE_CONFIG = {
  bleaching: {
    label: "Bleaching",
    parameterLabel: "Bleach Type",
    parameterOptions: STAGE_RATE_OPTION_MAP.bleaching,
    getParameterValue: (lot) => one(lot.bleaching)?.bleach_type || "",
    getProcessedMeters: (lot) => {
      const record = one(lot.bleaching);
      return n(record?.output_meters ?? record?.input_meters);
    },
  },
  masrise: {
    label: "Masrise",
    parameterLabel: "Parameter",
    parameterOptions: [],
    getParameterValue: () => "",
    getProcessedMeters: (lot) => {
      const record = one(lot.masrise);
      return n(record?.completed_meters ?? record?.input_meters);
    },
  },
  dyeing: {
    label: "Dyeing",
    parameterLabel: "Parameter",
    parameterOptions: [],
    getParameterValue: () => "",
    getProcessedMeters: (lot) => {
      const record = one(lot.dyeing);
      return n(record?.dyed_meters ?? record?.input_meters);
    },
  },
  stenter: {
    label: "Stenter",
    parameterLabel: "Parameter",
    parameterOptions: [],
    getParameterValue: () => "",
    getProcessedMeters: (lot) => {
      const record = one(lot.stenter);
      return n(record?.stentered_meters ?? record?.input_meters);
    },
  },
  finishing: {
    label: "Finishing",
    parameterLabel: "Finishing Type",
    parameterOptions: STAGE_RATE_OPTION_MAP.finishing,
    getParameterValue: (lot) => one(lot.finishing)?.finishing_type || "",
    getProcessedMeters: (lot) => {
      const record = one(lot.finishing);
      return n(record?.finished_meters ?? record?.input_meters);
    },
  },
  folding: {
    label: "Folding",
    parameterLabel: "Folding Type",
    parameterOptions: STAGE_RATE_OPTION_MAP.folding,
    getParameterValue: (lot) => one(lot.folding)?.folding_type || "",
    getProcessedMeters: (lot) => n(one(lot.folding)?.input_meters),
  },
};

export const STAGE_RATE_STAGE_OPTIONS = Object.keys(STAGE_RATE_CONFIG).map((key) => ({
  value: key,
  label: STAGE_RATE_CONFIG[key].label,
}));

export const emptyInstructionEditor = {
  lotNo: "",
  lotId: "",
  currentStage: "",
  status: "",
  checkedMeters: "",
  checkedLength: "",
  checkedJodis: "",
  include_bleaching: false,
  bleach_locked: false,
  bleach_type: "",
  include_masrise: false,
  masrise_locked: false,
  masrise_instruction: "",
  include_dyeing: false,
  dyeing_locked: false,
  include_stenter: false,
  stenter_locked: false,
  include_finishing: false,
  finishing_locked: false,
  finishing_type: "",
  include_folding: false,
  folding_locked: false,
  folding_type: "",
};

export const one = (value) => (Array.isArray(value) ? value[0] : value) || null;

const n = (value) => (typeof value === "number" ? value : Number(value || 0));

export const stageLabel = (stage) => STAGE_LABELS[stage] || stage || "-";
export const normalizeStageParameter = (value) => (value == null ? "" : String(value));

export const formatStageParameter = (stage, value) => {
  const normalized = normalizeStageParameter(value);
  if (!normalized) return "Standard";
  const option = STAGE_RATE_CONFIG[stage]?.parameterOptions?.find((item) => item.value === normalized);
  return option?.label || normalized;
};

export const getStatusTone = (status) => {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  return "warn";
};

export const getInstructionSelectionSummary = (lot) =>
  PLANNED_STAGE_ORDER.filter((stageKey) => {
    if (stageKey === "bleaching") return one(lot.bleaching)?.input_meters != null;
    if (stageKey === "masrise") return one(lot.masrise)?.input_meters != null;
    if (stageKey === "dyeing") return one(lot.dyeing)?.input_meters != null;
    if (stageKey === "stenter") return one(lot.stenter)?.input_meters != null;
    if (stageKey === "finishing") return one(lot.finishing)?.input_meters != null;
    if (stageKey === "folding") return one(lot.folding)?.input_meters != null;
    return false;
  }).map(stageLabel);

export const getProcessedMeters = (lot) => {
  const folding = one(lot.folding);
  const finishing = one(lot.finishing);
  const stenter = one(lot.stenter);
  const dyeing = one(lot.dyeing);
  const checking = one(lot.grey_checking);
  const inward = one(lot.grey_inward);
  const candidates = [
    n(folding?.input_meters),
    n(finishing?.finished_meters),
    n(stenter?.stentered_meters),
    n(dyeing?.dyed_meters),
    n(checking?.checked_meters),
    n(inward?.meters),
  ];
  return candidates.find((value) => value > 0) || 0;
};

export const getStageRateRecord = (rates, stage, parameterValue) => {
  const normalized = normalizeStageParameter(parameterValue);
  return rates.find((rate) => rate.stage === stage && normalizeStageParameter(rate.parameter_value) === normalized) || null;
};

export const buildBillingRows = (lots, stageRates, payments = []) => {
  const rows = [];
  const paymentMap = new Map(
    (payments || []).map((payment) => [
      `${payment.lot_id}-${payment.stage}-${normalizeStageParameter(payment.parameter_value)}`,
      payment,
    ]),
  );

  for (const lot of lots) {
    const checking = one(lot.grey_checking);
    const lotTaggas = n(checking?.taggas);

    for (const stage of PLANNED_STAGE_ORDER) {
      const record = one(lot[stage]);
      if (!record?.id) continue;

      const parameterValue = STAGE_RATE_CONFIG[stage]?.getParameterValue?.(lot) || "";
      const processedMeters = STAGE_RATE_CONFIG[stage]?.getProcessedMeters?.(lot) || 0;
      const rateRecord = getStageRateRecord(stageRates, stage, parameterValue);
      const meterRate = rateRecord?.meter_rate == null ? null : Number(rateRecord.meter_rate);
      const taggasRate = rateRecord?.taggas_rate == null ? null : Number(rateRecord.taggas_rate);
      const paymentKey = `${lot.id}-${stage}-${normalizeStageParameter(parameterValue)}`;
      const payment = paymentMap.get(paymentKey) || null;

      rows.push({
        id: `${lot.id}-${stage}`,
        lotId: lot.id,
        lotNo: lot.lot_no,
        partyName: lot.party?.name || "-",
        greyPartyName: lot.grey_party?.name || "-",
        clothType: lot.cloth_type || "-",
        createdAt: lot.created_at,
        stage,
        stageLabel: STAGE_RATE_CONFIG[stage]?.label || stageLabel(stage),
        parameterValue,
        parameterLabel: formatStageParameter(stage, parameterValue),
        meterRate,
        taggasRate,
        rateStatus: meterRate == null && taggasRate == null ? "not_set" : rateRecord?.is_active ? "active" : "inactive",
        taggas: lotTaggas,
        status: lot.status,
        currentStage: lot.current_stage,
        processedMeters: Number(processedMeters || 0),
        meterAmount: meterRate == null ? 0 : Number(processedMeters || 0) * meterRate,
        taggasAmount: taggasRate == null ? 0 : lotTaggas * taggasRate,
        payment,
        paid: Boolean(payment),
        paidUnit: payment?.paid_unit || null,
        paidAmount: payment?.paid_amount ?? 0,
        paidAt: payment?.paid_at ?? null,
      });
    }
  }

  return rows;
};

export const toPrintableDate = (value) => (value ? new Date(value).toLocaleString() : "-");

export const toCsv = (rows) => {
  const headers = [
    "Lot No",
    "Stage",
    "Status",
    "Party",
    "Grey Party",
    "Cloth Type",
    "Checked Meters",
    "Bleached No",
    "Dyed Meters",
    "Stentered Meters",
    "Finished Meters",
    "Processed Meters",
    "Created At",
  ];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.map(escape).join(",")];

  for (const lot of rows) {
    const checking = one(lot.grey_checking);
    const bleaching = one(lot.bleaching);
    const dyeing = one(lot.dyeing);
    const stenter = one(lot.stenter);
    const finishing = one(lot.finishing);
    lines.push(
      [
        lot.lot_no,
        stageLabel(lot.current_stage),
        lot.status,
        lot.party?.name || "",
        lot.grey_party?.name || "",
        lot.cloth_type || "",
        checking?.checked_meters ?? "",
        bleaching?.bleach_group_no ?? "",
        dyeing?.dyed_meters ?? "",
        stenter?.stentered_meters ?? "",
        finishing?.finished_meters ?? "",
        getProcessedMeters(lot),
        toPrintableDate(lot.created_at),
      ]
        .map(escape)
        .join(","),
    );
  }

  return lines.join("\n");
};

export const InstructionStageCard = ({ title, description, selected, locked, onToggle, children }) => (
  <div
    className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
      selected ? "border-blue-600 bg-blue-50 text-slate-900" : "border-slate-200 bg-white"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={locked}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          selected ? "bg-blue-600 text-white" : "border border-slate-300 bg-slate-50 text-slate-700"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {locked ? "Completed" : selected ? "Selected" : "Select"}
      </button>
    </div>
    {locked && <p className="mt-3 text-xs text-amber-700">Completed stages cannot be edited or removed.</p>}
    {selected && children ? <div className="mt-4 space-y-3">{children}</div> : null}
  </div>
);

export const AdminShellCard = ({ children, className = "" }) => (
  <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

export const MetricCard = ({ label, value, tone = "slate" }) => {
  const toneClasses = {
    slate: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
};

export const PanelHeader = ({ eyebrow, title, description, action }) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p> : null}
      <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const FilterLabel = ({ label, children, tone = "default" }) => (
  <label className="text-sm">
    <span className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] ${tone === "inverse" ? "text-slate-200" : "text-slate-500"}`}>
      {label}
    </span>
    {children}
  </label>
);

export const ConfirmDialog = ({ title, description, hint, onCancel, onConfirm, confirmLabel, busy, danger = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-950/40" onClick={() => !busy && onCancel()} />
    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={danger ? "btn-danger disabled:opacity-60" : "btn-primary disabled:opacity-60"}
        >
          {busy ? "Deleting..." : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);



