import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { formatDateTime } from "./adminUtils";

const ADMIN_PREF_AUTO_REFRESH = "admin.pref.auto_refresh";
const ADMIN_PREF_DENSITY = "admin.pref.table_density";
const ADMIN_PREF_WINDOW_DAYS = "admin.pref.default_window_days";

const getStoredBool = (key, fallback) => {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === "1";
};

const getStoredString = (key, fallback) => {
  const raw = localStorage.getItem(key);
  return raw == null ? fallback : raw;
};

const navItems = [
  { to: "/admin/dashboard/overview", label: "Overview" },
  { to: "/admin/dashboard/candidates", label: "Candidates" },
  { to: "/admin/dashboard/interviews", label: "Interviews" },
  { to: "/admin/dashboard/question-bank", label: "Question Bank" },
  { to: "/admin/dashboard/trials", label: "Trials" },
  { to: "/admin/dashboard/exports", label: "Exports" },
  { to: "/admin/dashboard/config", label: "Config" },
];

export default function AdminLayout() {
  const location = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(() => getStoredBool(ADMIN_PREF_AUTO_REFRESH, true));
  const [tableDensity, setTableDensity] = useState(() => getStoredString(ADMIN_PREF_DENSITY, "compact"));
  const [defaultWindowDays, setDefaultWindowDays] = useState(() => Number(getStoredString(ADMIN_PREF_WINDOW_DAYS, "30")) || 30);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    localStorage.setItem(ADMIN_PREF_AUTO_REFRESH, autoRefresh ? "1" : "0");
  }, [autoRefresh]);
  useEffect(() => {
    localStorage.setItem(ADMIN_PREF_DENSITY, String(tableDensity || "compact"));
  }, [tableDensity]);
  useEffect(() => {
    localStorage.setItem(ADMIN_PREF_WINDOW_DAYS, String(defaultWindowDays || 30));
  }, [defaultWindowDays]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, 20000);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const pageTitle = useMemo(() => {
    if (location.pathname.includes("/candidates/")) return "Candidate Detail";
    const matched = navItems.find((item) => location.pathname.startsWith(item.to));
    return matched ? matched.label : "Overview";
  }, [location.pathname]);

  const outletContext = useMemo(
    () => ({
      autoRefresh,
      setAutoRefresh,
      tableDensity,
      setTableDensity,
      defaultWindowDays,
      setDefaultWindowDays,
      lastRefreshedAt,
      setLastRefreshedAt,
      refreshTick,
      triggerRefresh: () => setRefreshTick((prev) => prev + 1),
    }),
    [autoRefresh, tableDensity, defaultWindowDays, lastRefreshedAt, refreshTick],
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <Box
        component="aside"
        sx={{
          width: { xs: 84, md: 240 },
          borderRight: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          p: 2,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, mb: 2, textAlign: { xs: "center", md: "left" } }}
        >
          Admin
        </Typography>
        <Stack spacing={1}>
          {navItems.map((item) => (
            <Button
              key={item.to}
              component={NavLink}
              to={item.to}
              variant={location.pathname.startsWith(item.to) ? "contained" : "text"}
              size="small"
              sx={{
                justifyContent: { xs: "center", md: "flex-start" },
                minWidth: 0,
                px: { xs: 1, md: 1.5 },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                {item.label}
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
                {item.label.slice(0, 1)}
              </Box>
            </Button>
          ))}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            px: { xs: 2, md: 3 },
            py: 1.2,
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{pageTitle}</Typography>
              <Typography variant="caption" color="text.secondary">
                Last refreshed: {formatDateTime(lastRefreshedAt)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                sx={{ m: 0 }}
                control={<Switch size="small" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                label="Auto refresh"
              />
              <Divider flexItem orientation="vertical" />
              <Button size="small" variant="outlined" onClick={() => setRefreshTick((prev) => prev + 1)}>
                Refresh
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet context={outletContext} />
        </Box>
      </Box>
    </Box>
  );
}
