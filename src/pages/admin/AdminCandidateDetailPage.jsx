import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import {
  candidateStatusChip,
  compactText,
  formatAdminInterviewType,
  formatDateTime,
  formatExpiryDateTime,
  sessionStatusChip,
  trialStatusChip,
} from "./adminUtils";

const TABS = ["profile", "setup", "sessions", "reports", "trials"];

export default function AdminCandidateDetailPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clerkUserId } = useParams();
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity } = useOutletContext();
  const initialTab = Math.max(0, TABS.indexOf(String(searchParams.get("tab") || "").toLowerCase()));
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [sessionsRows, setSessionsRows] = useState([]);
  const [reportsRows, setReportsRows] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    const nextTab = TABS[tab] || TABS[0];
    setSearchParams(nextTab === TABS[0] ? new URLSearchParams() : new URLSearchParams({ tab: nextTab }), { replace: true });
  }, [setSearchParams, tab]);

  useEffect(() => {
    let mounted = true;
    const loadDetail = async () => {
      if (!clerkUserId) return;
      setLoading(true);
      setError("");
      try {
        const payload = await requestJson(`/api/admin/candidates/${encodeURIComponent(clerkUserId)}`);
        if (!mounted) return;
        setDetail(payload);
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load candidate details.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      mounted = false;
    };
  }, [clerkUserId, refreshTick, requestJson, setLastRefreshedAt]);

  useEffect(() => {
    if (!clerkUserId) return;
    if (TABS[tab] !== "sessions" || sessionsRows.length > 0) return;
    let mounted = true;
    const loadSessions = async () => {
      setSessionsLoading(true);
      try {
        const payload = await requestJson(`/api/admin/interviews?page=1&page_size=100&q=${encodeURIComponent(clerkUserId)}`);
        if (!mounted) return;
        const filtered = (payload?.items || []).filter((row) => row.clerk_user_id === clerkUserId);
        setSessionsRows(filtered);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load interview sessions.");
      } finally {
        if (mounted) setSessionsLoading(false);
      }
    };
    loadSessions();
    return () => {
      mounted = false;
    };
  }, [tab, clerkUserId, requestJson, sessionsRows.length]);

  useEffect(() => {
    if (!clerkUserId) return;
    if (TABS[tab] !== "reports" || reportsRows.length > 0) return;
    let mounted = true;
    const loadReports = async () => {
      setReportsLoading(true);
      try {
        const payload = await requestJson(`/api/admin/reports?page=1&page_size=100&q=${encodeURIComponent(clerkUserId)}`);
        if (!mounted) return;
        const filtered = (payload?.items || []).filter((row) => row.clerk_user_id === clerkUserId);
        setReportsRows(filtered);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load reports.");
      } finally {
        if (mounted) setReportsLoading(false);
      }
    };
    loadReports();
    return () => {
      mounted = false;
    };
  }, [tab, clerkUserId, requestJson, reportsRows.length]);

  const profile = detail?.profile || {};
  const latestSetup = detail?.latest_preinterview || {};
  const candidate = detail?.candidate || {};
  const activeTrial = (detail?.trial_history || []).find((row) => row.is_active && !row.revoked_at);

  const onDeactivateCandidate = async () => {
    if (!clerkUserId) return;
    try {
      await requestJson(`/api/admin/candidates/${encodeURIComponent(clerkUserId)}/deactivate`, { method: "POST" });
      setLastRefreshedAt(new Date().toISOString());
      setDetail((prev) => prev ? { ...prev, candidate: { ...prev.candidate, is_active: false } } : prev);
    } catch (e) {
      setError(e.message || "Failed to deactivate candidate.");
    }
  };

  const onDeleteCandidate = async () => {
    if (!clerkUserId) return;
    try {
      await requestJson(`/api/admin/candidates/${encodeURIComponent(clerkUserId)}`, { method: "DELETE" });
      navigate("/admin/dashboard/candidates");
    } catch (e) {
      setError(e.message || "Failed to delete candidate.");
    }
  };

  const renderPanel = () => {
    const key = TABS[tab];
    if (key === "profile") {
      return (
        <Stack spacing={1}>
          <Typography variant="body2">Name: {candidate.full_name || "-"}</Typography>
          <Typography variant="body2">Email: {candidate.email || "-"}</Typography>
          <Typography variant="body2">Phone: {candidate.phone_e164 || "-"}</Typography>
          <Typography variant="body2">Registered: {formatDateTime(candidate.created_at)}</Typography>
          <Typography variant="body2">Last Login: {formatDateTime(candidate.last_login_at)}</Typography>
          <Typography variant="body2">Category: {profile.user_category || "-"}</Typography>
          <Typography variant="body2">Primary Goal: {profile.primary_goal || "-"}</Typography>
          <Typography variant="body2">Target Roles: {compactText(profile.target_roles)}</Typography>
          <Typography variant="body2">Industries: {compactText(profile.industries)}</Typography>
          <Typography variant="body2">Domain Expertise: {compactText(profile.domain_expertise)}</Typography>
          <Typography variant="body2">Current Role: {profile.current_role || "-"}</Typography>
          <Typography variant="body2">Experience Band: {profile.experience_band || "-"}</Typography>
          <Typography variant="body2">Interview Timeline: {profile.interview_timeline || "-"}</Typography>
          <Typography variant="body2">Prep Intensity: {profile.prep_intensity || "-"}</Typography>
          <Typography variant="body2">Learning Style: {profile.learning_style || "-"}</Typography>
        </Stack>
      );
    }
    if (key === "setup") {
      return (
        <Stack spacing={1}>
          <Typography variant="body2">Interview Type: {formatAdminInterviewType(latestSetup.interview_type)}</Typography>
          <Typography variant="body2">Difficulty: {latestSetup.difficulty || "-"}</Typography>
          <Typography variant="body2">Role: {latestSetup.role || "-"}</Typography>
          <Typography variant="body2">Company: {latestSetup.company || "-"}</Typography>
          <Typography variant="body2">Question Mix: {latestSetup.question_mix || "-"}</Typography>
          <Typography variant="body2">Interview Style: {latestSetup.interview_style || "-"}</Typography>
          <Typography variant="body2">Plan Tier: {latestSetup.plan_tier || "-"}</Typography>
          <Typography variant="body2">Selected Skills: {compactText(latestSetup.selected_skills)}</Typography>
          <Typography variant="body2">
            Duration (req/eff): {latestSetup.duration_minutes_requested || "-"} / {latestSetup.duration_minutes_effective || "-"}
          </Typography>
        </Stack>
      );
    }
    if (key === "sessions") {
      if (sessionsLoading) {
        return (
          <Box sx={{ py: 3, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        );
      }
      const rows = sessionsRows.length ? sessionsRows : (detail?.sessions || []);
      return (
        <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
          <TableHead>
            <TableRow>
              <TableCell>Session ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Difficulty</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Ended</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.session_id}>
                <TableCell>{row.session_id}</TableCell>
                <TableCell>{sessionStatusChip(row.status)}</TableCell>
                <TableCell>{formatAdminInterviewType(row.interview_type)}</TableCell>
                <TableCell>{row.difficulty || "-"}</TableCell>
                <TableCell>{formatDateTime(row.started_at)}</TableCell>
                <TableCell>{formatDateTime(row.ended_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    if (key === "reports") {
      if (reportsLoading) {
        return (
          <Box sx={{ py: 3, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        );
      }
      const rows = reportsRows.length ? reportsRows : (detail?.reports || []);
      return (
        <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
          <TableHead>
            <TableRow>
              <TableCell>Report ID</TableCell>
              <TableCell>Session ID</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Capture</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.report_id || row.id}>
                <TableCell>{row.report_id || row.id}</TableCell>
                <TableCell>{row.session_id || "-"}</TableCell>
                <TableCell>{row.overall_score ?? "-"}</TableCell>
                <TableCell>{formatAdminInterviewType(row.interview_type || row.type)}</TableCell>
                <TableCell>{row.capture_status || "-"}</TableCell>
                <TableCell>{row.evaluation_source || "-"}</TableCell>
                <TableCell>{formatDateTime(row.created_at || row.date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    return (
      <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
        <TableHead>
          <TableRow>
            <TableCell>Plan Tier</TableCell>
            <TableCell>Display Name</TableCell>
            <TableCell>Trial Code</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Starts</TableCell>
            <TableCell>Expires</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(detail?.trial_history || []).map((row) => (
            <TableRow key={row.entitlement_id}>
              <TableCell>{row.plan_tier || "-"}</TableCell>
              <TableCell>{row.trial_code_display_name || "-"}</TableCell>
              <TableCell>{row.trial_code || "-"}</TableCell>
              <TableCell>{trialStatusChip(row.trial_code_status)}</TableCell>
              <TableCell>{formatDateTime(row.starts_at)}</TableCell>
              <TableCell>{formatExpiryDateTime(row.expires_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" size="small" onClick={() => navigate("/admin/dashboard/candidates")}>Back</Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {candidate?.full_name || candidate?.email || clerkUserId}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" color="warning" onClick={onDeactivateCandidate}>
            Deactivate
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={onDeleteCandidate}>
            Delete
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Candidate Status</Typography>
              <Box sx={{ mt: 1 }}>{candidateStatusChip(candidate)}</Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Reports</Typography>
              <Typography variant="h6">{(detail?.reports || []).length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Sessions</Typography>
              <Typography variant="h6">{(detail?.sessions || []).length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Active Trial</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {activeTrial?.trial_code_display_name || activeTrial?.trial_code || "None"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeTrial ? formatExpiryDateTime(activeTrial.expires_at) : "-"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="outlined" size="small" onClick={() => navigate("/admin/dashboard/candidates")}>Back</Button>
        <Button size="small" variant="text" onClick={() => setTab(TABS.indexOf("trials"))}>Jump to Trials</Button>
        <Button size="small" variant="text" onClick={() => setTab(TABS.indexOf("reports"))}>Jump to Reports</Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                allowScrollButtonsMobile
              >
                <Tab label="Profile" />
                <Tab label="Interview Setup" />
                <Tab label="Sessions" />
                <Tab label="Reports" />
                <Tab label="Entitlements & Trials" />
              </Tabs>
              <Box sx={{ mt: 2 }}>{renderPanel()}</Box>
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
