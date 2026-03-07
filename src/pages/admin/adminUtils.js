import React from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { formatInterviewTypeLabel } from "../../utils/interviewTypeLabels";

export const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return "-";
  }
};

export const safeArray = (value) => (Array.isArray(value) ? value : []);

export const compactText = (items = []) => {
  const cleaned = safeArray(items).map((item) => String(item || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "-";
};

export const loginRecencyChip = (value) => {
  const recency = String(value || "stale").toLowerCase();
  if (recency === "today") return <Chip label="Today" size="small" color="success" />;
  if (recency === "7d") return <Chip label="7d" size="small" color="primary" />;
  if (recency === "30d") return <Chip label="30d" size="small" color="warning" />;
  return <Chip label="Stale" size="small" variant="outlined" />;
};

export const candidateStatusChip = (row) => {
  if (row?.is_deleted) return <Chip label="Deleted" size="small" color="error" />;
  if (row?.is_active) return <Chip label="Active" size="small" color="success" />;
  return <Chip label="Inactive" size="small" variant="outlined" />;
};

export const sessionStatusChip = (status) => {
  const token = String(status || "").toUpperCase();
  if (token === "COMPLETED") return <Chip label="Completed" size="small" color="success" />;
  if (token === "ACTIVE") return <Chip label="Active" size="small" color="primary" />;
  if (token === "FAILED") return <Chip label="Failed" size="small" color="error" />;
  return <Chip label={token || "Unknown"} size="small" variant="outlined" />;
};

export const renderDistribution = (distribution = {}, options = {}) => {
  const formatKey = typeof options.formatKey === "function" ? options.formatKey : (key) => key;
  const entries = Object.entries(distribution || {});
  if (!entries.length) return <Typography variant="body2" color="text.secondary">No data</Typography>;
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {entries.map(([key, count]) => (
        <Chip key={key} label={`${formatKey(key)}: ${count}`} size="small" variant="outlined" />
      ))}
    </Stack>
  );
};

export const renderTopItems = (items = [], options = {}) => {
  const formatKey = typeof options.formatKey === "function" ? options.formatKey : (key) => key;
  if (!Array.isArray(items) || items.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data</Typography>;
  }
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {items.map((item) => (
        <Chip key={`${item.key}-${item.count}`} label={`${formatKey(item.key)} (${item.count})`} size="small" />
      ))}
    </Stack>
  );
};

export const formatAdminInterviewType = (value) => formatInterviewTypeLabel(value);
