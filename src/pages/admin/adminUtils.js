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

export const formatExpiryDateTime = (value) => {
  if (!value) return "Never";
  return formatDateTime(value);
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

export const trialStatusChip = (status) => {
  const token = String(status || "").toUpperCase();
  if (token === "ACTIVE") return <Chip label="Active" size="small" color="success" />;
  if (token === "REDEEMED") return <Chip label="Redeemed" size="small" color="primary" />;
  if (token === "REVOKED") return <Chip label="Revoked" size="small" color="warning" />;
  if (token === "DELETED") return <Chip label="Deleted" size="small" color="error" />;
  if (token === "EXPIRED") return <Chip label="Expired" size="small" variant="outlined" />;
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

export const readSearchParam = (searchParams, key, fallback = "") => {
  const value = searchParams?.get?.(key);
  return value == null ? fallback : value;
};

export const readBooleanSearchParam = (searchParams, key, fallback = false) => {
  const value = searchParams?.get?.(key);
  if (value == null) return fallback;
  return value === "1" || value === "true";
};

export const updateSearchParamsState = (setSearchParams, updates, options = { replace: true }) => {
  setSearchParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (value == null || value === "" || value === false) {
        next.delete(key);
        return;
      }
      if (value === true) {
        next.set(key, "1");
        return;
      }
      next.set(key, String(value));
    });
    return next;
  }, options);
};
