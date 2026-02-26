export const STAGE_OPTIONS = [
  "grey_inward",
  "checking",
  "bleaching",
  "dyeing",
  "stenter",
  "finishing",
  "folding",
];

export const STAGE_LABELS = {
  grey_inward: "Grey Inward",
  checking: "Checking",
  bleaching: "Bleaching",
  dyeing: "Dyeing",
  stenter: "Stenter",
  finishing: "Finishing",
  folding: "Folding",
};

export const STAGE_FORM_CONFIG = {
  grey_inward: {
    table: "grey_inward",
    title: "Grey Inward Entry",
    expectedStage: "grey_inward",
    fields: [
      { key: "meters", label: "Meters", type: "number" },
      { key: "jodis", label: "Jodis", type: "number" },
      { key: "tagge", label: "Tagge", type: "number" },
      { key: "fold_details", label: "Fold Details", type: "text" },
      { key: "border", label: "Border", type: "text" },
    ],
  },
  checking: {
    table: "grey_checking",
    title: "Checking Entry",
    expectedStage: "checking",
    fields: [
      {
        key: "checking_method",
        label: "Checking Method",
        type: "select",
        options: ["cotton_fabric", "cotton", "stamp", "poly_stamp", "roto_stamp", "roto_tube", "others"],
      },
      { key: "input_meters", label: "Input Meters", type: "number" },
      { key: "checked_meters", label: "Checked Meters", type: "number" },
      { key: "jodis", label: "Jodis", type: "number" },
      { key: "taggas", label: "Taggas", type: "number" },
      { key: "tp", label: "TP", type: "text" },
      { key: "fold", label: "Fold", type: "text" },
      { key: "less_short", label: "Less / Short", type: "number" },
    ],
  },
  bleaching: {
    table: "bleaching",
    title: "Bleaching Entry",
    expectedStage: "bleaching",
    fields: [
      {
        key: "bleach_type",
        label: "Bleach Type",
        type: "select",
        options: ["hand_poly", "hand_cotton", "power_poly", "power_cotton", "power_cotton_squeezing", "others"],
      },
      { key: "input_meters", label: "Input Meters", type: "number" },
      { key: "output_meters", label: "Output Meters", type: "number" },
      {
        key: "next_stage",
        label: "Next Stage",
        type: "select",
        options: ["dyeing", "stenter"],
      },
    ],
  },
  dyeing: {
    table: "dyeing",
    title: "Dyeing Entry",
    expectedStage: "dyeing",
    fields: [
      { key: "input_meters", label: "Input Meters", type: "number" },
      { key: "dyed_meters", label: "Dyed Meters", type: "number" },
      { key: "sent_to_stenter", label: "Sent To Stenter", type: "checkbox" },
    ],
  },
  stenter: {
    table: "stenter",
    title: "Stenter Entry",
    expectedStage: "stenter",
    fields: [
      { key: "input_meters", label: "Input Meters", type: "number" },
      { key: "stentered_meters", label: "Stentered Meters", type: "number" },
    ],
  },
  finishing: {
    table: "finishing",
    title: "Finishing Entry",
    expectedStage: "finishing",
    fields: [
      { key: "input_meters", label: "Input Meters", type: "number" },
      { key: "finished_meters", label: "Finished Meters", type: "number" },
      {
        key: "finishing_type",
        label: "Finishing Type",
        type: "select",
        options: ["cold_felt", "double_felt", "single_felt", "cold_finish"],
      },
    ],
  },
  folding: {
    table: "folding",
    title: "Folding Entry",
    expectedStage: "folding",
    fields: [
      { key: "input_meters", label: "Input Meters", type: "number" },
      {
        key: "folding_type",
        label: "Folding Type",
        type: "select",
        options: ["single_fold", "double_fold", "double_fold_checking", "single_fold_cutting"],
      },
      { key: "worker_name", label: "Worker Name", type: "text" },
    ],
  },
};
