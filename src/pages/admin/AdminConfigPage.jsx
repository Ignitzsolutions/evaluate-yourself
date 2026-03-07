import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import { formatDateTime } from "./adminUtils";

export default function AdminConfigPage() {
  const { requestJson } = useAdminApi();
  const {
    refreshTick,
    setLastRefreshedAt,
    autoRefresh,
    setAutoRefresh,
    tableDensity,
    setTableDensity,
    defaultWindowDays,
    setDefaultWindowDays,
  } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await requestJson("/api/admin/config");
        if (!mounted) return;
        setConfig(payload);
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load admin config.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [requestJson, refreshTick, setLastRefreshedAt]);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.2 }}>UI Preferences (Safe Runtime)</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Auto refresh</Typography>
              <Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            </Stack>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="density-label">Table Density</InputLabel>
              <Select
                labelId="density-label"
                label="Table Density"
                value={tableDensity}
                onChange={(e) => setTableDensity(e.target.value)}
              >
                <MenuItem value="compact">Compact</MenuItem>
                <MenuItem value="comfortable">Comfortable</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="window-label">Default Window Days</InputLabel>
              <Select
                labelId="window-label"
                label="Default Window Days"
                value={defaultWindowDays}
                onChange={(e) => setDefaultWindowDays(Number(e.target.value) || 30)}
              >
                <MenuItem value={7}>7 days</MenuItem>
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={60}>60 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.2 }}>System Configuration (Read-only)</Typography>
          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={0.7}>
              <Typography variant="body2">Generated At: {formatDateTime(config?.generated_at)}</Typography>
              <Typography variant="body2">Environment: {config?.environment || "-"}</Typography>
              <Typography variant="body2">DB Health: {config?.db?.health || "-"}</Typography>
              <Typography variant="body2">DB Engine: {config?.db?.engine || "-"}</Typography>
              <Typography variant="body2">
                Admin Access Mode: {config?.admin_access?.mode || "-"} (allowlist_count: {config?.admin_access?.allowlist_count ?? 0})
              </Typography>
              <Typography variant="body2">CORS configured: {String(Boolean(config?.cors?.is_configured))}</Typography>
              <Typography variant="body2">CORS wildcard: {String(Boolean(config?.cors?.wildcard))}</Typography>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>Feature Flags</Typography>
              <Typography variant="body2">Trial Mode: {String(Boolean(config?.flags?.trial_mode_enabled))}</Typography>
              <Typography variant="body2">Trial Enforcement: {String(Boolean(config?.flags?.trial_code_enforcement))}</Typography>
              <Typography variant="body2">Interview Server Control: {String(Boolean(config?.flags?.interview_server_control_enabled))}</Typography>
              <Typography variant="body2">Skill Tracks Enabled: {String(Boolean(config?.flags?.interview_skill_tracks_enabled))}</Typography>
              <Typography variant="body2">Prompt Injection Guard: {String(Boolean(config?.flags?.interview_prompt_injection_guard_enabled))}</Typography>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>Evaluation Flags</Typography>
              <Typography variant="body2">Hard Guards: {String(Boolean(config?.flags?.eval?.hard_guards))}</Typography>
              <Typography variant="body2">Client Turns Trusted: {String(Boolean(config?.flags?.eval?.client_turns_trusted))}</Typography>
              <Typography variant="body2">Deterministic Rubric: {String(Boolean(config?.flags?.eval?.deterministic_rubric))}</Typography>
              <Typography variant="body2">Contract Mode: {config?.flags?.eval?.contract_mode || "-"}</Typography>
              <Typography variant="body2">Scorer Mode: {config?.flags?.eval?.scorer_mode || "-"}</Typography>
              <Typography variant="body2">Rubric / Scorer: {config?.flags?.eval?.rubric_version || "-"} / {config?.flags?.eval?.scorer_version || "-"}</Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

