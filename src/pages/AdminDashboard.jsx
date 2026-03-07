import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";

const API_BASE = getApiBaseUrl();

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return "-";
  }
};

const loginRecencyChip = (value) => {
  const recency = String(value || "stale").toLowerCase();
  if (recency === "today") return <Chip label="Today" size="small" color="success" />;
  if (recency === "7d") return <Chip label="7d" size="small" color="primary" />;
  if (recency === "30d") return <Chip label="30d" size="small" color="warning" />;
  return <Chip label="Stale" size="small" variant="outlined" />;
};

const statusChip = (row) => {
  if (row?.is_deleted) return <Chip label="Deleted" size="small" color="error" />;
  if (row?.is_active) return <Chip label="Active" size="small" color="success" />;
  return <Chip label="Inactive" size="small" variant="outlined" />;
};

const sessionStatusChip = (status) => {
  const token = String(status || "").toUpperCase();
  if (token === "COMPLETED") return <Chip label="Completed" size="small" color="success" />;
  if (token === "ACTIVE") return <Chip label="Active" size="small" color="primary" />;
  if (token === "FAILED") return <Chip label="Failed" size="small" color="error" />;
  return <Chip label={token || "Unknown"} size="small" variant="outlined" />;
};

const renderDistribution = (distribution = {}, options = {}) => {
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

const renderTopItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return <Typography variant="body2" color="text.secondary">No data</Typography>;
  }
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {items.map((item) => (
        <Chip key={`${item.key}-${item.count}`} label={`${item.key} (${item.count})`} size="small" />
      ))}
    </Stack>
  );
};

const compactText = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return "-";
  return items.filter(Boolean).join(", ");
};

const safeNum = (value) => Number(value || 0);

const statusFilterOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trialCodes, setTrialCodes] = useState([]);
  const [trialSuffixFilter, setTrialSuffixFilter] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trialCodeInput, setTrialCodeInput] = useState({
    duration_minutes: 5,
    expires_in_days: 7,
    note: "",
    code_suffix: "",
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState(null);

  const fetchJson = useCallback(
    async (path, options = {}) => {
      const token = await getToken();
      const resp = await authFetch(`${API_BASE}${path}`, token, options);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Request failed: ${resp.status}`);
      }
      return resp.json();
    },
    [getToken],
  );

  const loadAll = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const trialSuffixQuery = trialSuffixFilter.trim()
        ? `&suffix=${encodeURIComponent(trialSuffixFilter.trim().toUpperCase())}`
        : "";
      const [summaryResp, overviewResp, candidatesResp, trialResp] = await Promise.all([
        fetchJson("/api/admin/summary"),
        fetchJson("/api/admin/dashboard/overview"),
        fetchJson(`/api/admin/candidates?page=1&page_size=25&q=${encodeURIComponent(candidateQuery)}&status=${statusFilter}`),
        fetchJson(`/api/admin/trial-codes?page=1&page_size=25${trialSuffixQuery}`),
      ]);
      setSummary(summaryResp);
      setOverview(overviewResp);
      setCandidates(candidatesResp.items || []);
      setCandidateTotal(candidatesResp.total || 0);
      setTrialCodes(trialResp.items || []);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e.message || "Failed to load admin data");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [candidateQuery, fetchJson, statusFilter, trialSuffixFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      loadAll({ silent: true });
    }, 20000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadAll]);

  const metricCards = useMemo(() => {
    if (!summary || !overview) return [];
    return [
      ["Candidates", summary.total_candidates],
      ["Logged In (24h)", summary.logged_in_24h],
      ["Active Sessions", overview?.table_counts?.interview_sessions_active],
      ["Completed Sessions", overview?.table_counts?.interview_sessions_completed],
      ["Reports", summary.total_reports],
      ["Avg Score", summary.avg_score],
      ["Active Trials", summary.active_trials],
      ["Registered (24h)", summary.registered_24h],
    ];
  }, [summary, overview]);

  const healthCards = useMemo(() => {
    const health = overview?.candidate_health || {};
    return [
      ["Missing Profiles", safeNum(health.missing_profile_count), "warning"],
      ["Missing Contact", safeNum(health.missing_contact_count), "warning"],
      ["Stale Login (30d+)", safeNum(health.stale_login_count_30d), "error"],
      ["No Reports Yet", safeNum(health.no_reports_count), "info"],
    ];
  }, [overview]);

  const onDeactivate = async (clerkUserId) => {
    try {
      await fetchJson(`/api/admin/candidates/${clerkUserId}/deactivate`, { method: "POST" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteCandidate = async (clerkUserId) => {
    try {
      await fetchJson(`/api/admin/candidates/${clerkUserId}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const onOpenDetail = async (clerkUserId) => {
    try {
      const detail = await fetchJson(`/api/admin/candidates/${clerkUserId}`);
      setCandidateDetail(detail);
      setDetailOpen(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const onCreateTrialCode = async () => {
    try {
      const payload = {
        duration_minutes: Number(trialCodeInput.duration_minutes) || 5,
        expires_in_days: Number(trialCodeInput.expires_in_days) || 7,
        note: trialCodeInput.note || "",
        code_suffix: (trialCodeInput.code_suffix || "").trim().toUpperCase() || null,
      };
      await fetchJson("/api/admin/trial-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTrialCodeInput({ duration_minutes: 5, expires_in_days: 7, note: "", code_suffix: "" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const onDeleteTrialCode = async (codeId) => {
    try {
      await fetchJson(`/api/admin/trial-codes/${codeId}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" sx={{ mb: 2 }} spacing={1}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Admin Operations Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {formatDateTime(lastRefreshedAt)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
            label="Auto Refresh"
          />
          <Button variant="outlined" onClick={() => loadAll()}>Refresh Now</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && (
        <Box sx={{ display: "grid", placeItems: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metricCards.map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <Card>
              <CardContent>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{String(value ?? 0)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Action Needed</Typography>
          <Grid container spacing={1.5}>
            {healthCards.map(([label, value, color]) => (
              <Grid item xs={6} md={3} key={label}>
                <Card variant="outlined" sx={{ borderColor: color === "error" ? "error.light" : "divider" }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Candidate Funnel</Typography>
              <Grid container spacing={1}>
                {Object.entries(overview?.candidate_funnel || {}).map(([key, value]) => (
                  <Grid item xs={6} key={key}>
                    <Typography variant="caption" color="text.secondary">{key}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(value ?? 0)}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>System & DB</Typography>
              <Typography variant="body2">Health: {overview?.db?.health || summary?.db_health || "-"}</Typography>
              <Typography variant="body2">Engine: {overview?.db?.engine || summary?.db_engine || "-"}</Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>Generated At: {formatDateTime(overview?.db?.generated_at)}</Typography>
              <Divider sx={{ mb: 1.5 }} />
              <Grid container spacing={1}>
                {Object.entries(overview?.table_counts || {}).map(([key, value]) => (
                  <Grid item xs={6} md={4} key={key}>
                    <Typography variant="caption" color="text.secondary">{key}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(value ?? 0)}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Recent Sessions</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Candidate</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Skills</TableCell>
                    <TableCell>Started</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(overview?.recent_activity?.sessions || []).map((row) => (
                    <TableRow key={row.session_id}>
                      <TableCell>{row.name || row.email || row.clerk_user_id || "-"}</TableCell>
                      <TableCell>{formatInterviewTypeLabel(row.interview_type)}</TableCell>
                      <TableCell>{sessionStatusChip(row.status)}</TableCell>
                      <TableCell>{compactText(row.selected_skills)}</TableCell>
                      <TableCell>{formatDateTime(row.started_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Recent Reports</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Candidate</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Capture</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(overview?.recent_activity?.reports || []).map((row) => (
                    <TableRow key={row.report_id}>
                      <TableCell>{row.name || row.email || row.clerk_user_id || "-"}</TableCell>
                      <TableCell>{row.overall_score ?? "-"}</TableCell>
                      <TableCell>{row.capture_status || "-"}</TableCell>
                      <TableCell>{row.evaluation_source || "-"}</TableCell>
                      <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Interview Metadata</Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Interview Type</Typography>
              {renderDistribution(overview?.interview_metadata?.interview_type_distribution, { formatKey: formatInterviewTypeLabel })}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Difficulty</Typography>
              {renderDistribution(overview?.interview_metadata?.difficulty_distribution)}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Question Mix</Typography>
              {renderDistribution(overview?.interview_metadata?.question_mix_distribution)}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Interview Style</Typography>
              {renderDistribution(overview?.interview_metadata?.interview_style_distribution)}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Top Metadata</Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Selected Skills</Typography>
              {renderTopItems(overview?.interview_metadata?.selected_skills_top)}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Target Roles</Typography>
              {renderTopItems(overview?.interview_metadata?.target_roles_top)}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Target Companies</Typography>
              {renderTopItems(overview?.interview_metadata?.target_companies_top)}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Trial Operations</Typography>
              <Grid container spacing={1}>
                {Object.entries(overview?.trials || {}).map(([key, value]) => (
                  <Grid item xs={6} key={key}>
                    <Typography variant="caption" color="text.secondary">{key}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{String(value ?? 0)}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Evaluation Quality</Typography>
              <Typography variant="body2">Invalid Contracts: {overview?.quality?.invalid_contract_reports ?? 0}</Typography>
              <Typography variant="body2">Forced Zero (No Evidence): {overview?.quality?.zero_score_without_evidence_attempts_blocked ?? 0}</Typography>
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Source Distribution (7d)</Typography>
              {renderDistribution(overview?.quality?.source_distribution_last_7_days)}
              <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>Contract Failed Reasons</Typography>
              {renderDistribution(overview?.quality?.contract_failed_reasons)}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Candidates ({candidateTotal})</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Search candidate"
              value={candidateQuery}
              onChange={(e) => setCandidateQuery(e.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="candidate-status-label">Status</InputLabel>
              <Select
                labelId="candidate-status-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusFilterOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={() => loadAll()}>Apply</Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Candidate</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Profile</TableCell>
                <TableCell>Latest Interview</TableCell>
                <TableCell>Sessions / Reports</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.map((row) => (
                <TableRow key={row.clerk_user_id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.full_name || row.clerk_user_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Registered: {formatDateTime(row.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.email || "-"}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.phone_e164 || "-"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">Goal: {row.profile_primary_goal || "-"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Roles: {compactText(row.profile_target_roles)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatInterviewTypeLabel(row.latest_interview_type)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.latest_session_status || "-"} | {formatDateTime(row.latest_session_started_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Skills: {compactText(row.latest_selected_skills)}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.session_count} / {row.report_count}</TableCell>
                  <TableCell>{row.latest_plan_tier || row.current_entitlement?.plan_tier || "-"}</TableCell>
                  <TableCell>
                    <Box>{formatDateTime(row.last_login_at)}</Box>
                    <Box sx={{ mt: 0.5 }}>{loginRecencyChip(row.login_recency)}</Box>
                  </TableCell>
                  <TableCell>{statusChip(row)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => onOpenDetail(row.clerk_user_id)}>View</Button>
                      <Button size="small" color="warning" onClick={() => onDeactivate(row.clerk_user_id)}>Deactivate</Button>
                      <Button size="small" color="error" onClick={() => onDeleteCandidate(row.clerk_user_id)}>Delete</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Create Trial Code</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              type="number"
              label="Duration minutes"
              value={trialCodeInput.duration_minutes}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, duration_minutes: Number(e.target.value) || 5 }))}
            />
            <TextField
              size="small"
              type="number"
              label="Expires in days"
              value={trialCodeInput.expires_in_days}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, expires_in_days: Number(e.target.value) || 7 }))}
            />
            <TextField
              size="small"
              label="Code Suffix (Optional)"
              placeholder="ABC123"
              value={trialCodeInput.code_suffix}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, code_suffix: e.target.value.toUpperCase() }))}
              helperText="2-12 chars, A-Z and 0-9 only"
            />
            <TextField
              size="small"
              label="Note"
              value={trialCodeInput.note}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, note: e.target.value }))}
            />
            <Button variant="contained" onClick={onCreateTrialCode}>Create</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Trial Codes</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Filter by suffix"
                value={trialSuffixFilter}
                onChange={(e) => setTrialSuffixFilter(e.target.value.toUpperCase())}
              />
              <Button variant="outlined" onClick={() => loadAll()}>Apply</Button>
            </Stack>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Suffix</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Redeemed By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trialCodes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.code_suffix || "-"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.duration_minutes}m</TableCell>
                  <TableCell>{row.redeemed_by_clerk_user_id || "-"}</TableCell>
                  <TableCell>{formatDateTime(row.created_at)}</TableCell>
                  <TableCell>{formatDateTime(row.expires_at)}</TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={() => onDeleteTrialCode(row.id)}>Delete/Revoke</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Candidate Detail</DialogTitle>
        <DialogContent>
          {!candidateDetail ? null : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Contact</Typography>
                <Typography variant="body2">Name: {candidateDetail?.candidate?.full_name || "-"}</Typography>
                <Typography variant="body2">Email: {candidateDetail?.candidate?.email || "-"}</Typography>
                <Typography variant="body2">Phone: {candidateDetail?.candidate?.phone_e164 || "-"}</Typography>
                <Typography variant="body2">Clerk User ID: {candidateDetail?.candidate?.clerk_user_id || "-"}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Profile</Typography>
                <Typography variant="body2">Category: {candidateDetail?.profile?.user_category || "-"}</Typography>
                <Typography variant="body2">Primary Goal: {candidateDetail?.profile?.primary_goal || "-"}</Typography>
                <Typography variant="body2">Current Role: {candidateDetail?.profile?.current_role || "-"}</Typography>
                <Typography variant="body2">Target Roles: {(candidateDetail?.profile?.target_roles || []).join(", ") || "-"}</Typography>
                <Typography variant="body2">Domain Expertise: {(candidateDetail?.profile?.domain_expertise || []).join(", ") || "-"}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Latest Interview Setup</Typography>
                <Typography variant="body2">Role: {candidateDetail?.latest_preinterview?.role || "-"}</Typography>
                <Typography variant="body2">Company: {candidateDetail?.latest_preinterview?.company || "-"}</Typography>
                <Typography variant="body2">Question Mix: {candidateDetail?.latest_preinterview?.question_mix || "-"}</Typography>
                <Typography variant="body2">Interview Style: {candidateDetail?.latest_preinterview?.interview_style || "-"}</Typography>
                <Typography variant="body2">Difficulty: {candidateDetail?.latest_preinterview?.difficulty || "-"}</Typography>
                <Typography variant="body2">Plan Tier: {candidateDetail?.latest_preinterview?.plan_tier || "-"}</Typography>
                <Typography variant="body2">Selected Skills: {(candidateDetail?.latest_preinterview?.selected_skills || []).join(", ") || "-"}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Recent Sessions</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Session</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Started</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(candidateDetail?.sessions || []).slice(0, 8).map((row) => (
                      <TableRow key={row.session_id}>
                        <TableCell>{row.session_id}</TableCell>
                        <TableCell>{formatInterviewTypeLabel(row.interview_type)}</TableCell>
                        <TableCell>{row.status || "-"}</TableCell>
                        <TableCell>{formatDateTime(row.started_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Recent Reports</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Report ID</TableCell>
                      <TableCell>Session</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(candidateDetail?.reports || []).slice(0, 8).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.session_id || "-"}</TableCell>
                        <TableCell>{row.overall_score ?? "-"}</TableCell>
                        <TableCell>{formatDateTime(row.date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
