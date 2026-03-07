import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { renderDistribution, renderTopItems, sessionStatusChip, compactText, formatDateTime, formatAdminInterviewType } from "./adminUtils";
import { useAdminApi } from "./useAdminApi";

export default function AdminOverviewPage() {
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [activeUsers, setActiveUsers] = useState(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryData, overviewData, activeData] = await Promise.all([
          requestJson("/api/admin/summary"),
          requestJson("/api/admin/dashboard/overview"),
          requestJson("/api/admin/active-users?window_minutes=15&page=1&page_size=10"),
        ]);
        if (!mounted) return;
        setSummary(summaryData);
        setOverview(overviewData);
        setActiveUsers(activeData);
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load admin overview.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [refreshTick, requestJson, setLastRefreshedAt]);

  const kpis = useMemo(() => {
    if (!summary || !overview) return [];
    return [
      ["Candidates", summary.total_candidates],
      ["Active Users (Now)", overview?.candidate_funnel?.active_users_now ?? 0],
      ["Active Users (15m)", overview?.candidate_funnel?.active_users_last_15m_count ?? 0],
      ["Active Sessions", overview?.table_counts?.interview_sessions_active ?? 0],
      ["Reports", summary.total_reports],
      ["Avg Score", summary.avg_score],
      ["Active Trials", summary.active_trials],
      ["Registered 24h", summary.registered_24h],
    ];
  }, [summary, overview]);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={1.5}>
        {kpis.map(([label, value]) => (
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

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Action Needed</Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">Missing Profiles</Typography>
              <Typography variant="h6">{overview?.candidate_health?.missing_profile_count ?? 0}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">Missing Contact</Typography>
              <Typography variant="h6">{overview?.candidate_health?.missing_contact_count ?? 0}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">Stale Login (30d)</Typography>
              <Typography variant="h6">{overview?.candidate_health?.stale_login_count_30d ?? 0}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">No Reports</Typography>
              <Typography variant="h6">{overview?.candidate_health?.no_reports_count ?? 0}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.2 }}>Active Users (15m)</Typography>
              <Typography variant="body2" sx={{ mb: 1.2 }}>
                Live now: {activeUsers?.count_now ?? 0} | Last 15m: {activeUsers?.count_window ?? 0}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Reasons</TableCell>
                    <TableCell>Last Login</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(activeUsers?.items || []).map((row) => (
                    <TableRow key={row.clerk_user_id}>
                      <TableCell>{row.full_name || row.email || row.clerk_user_id}</TableCell>
                      <TableCell>{compactText(row.active_reasons)}</TableCell>
                      <TableCell>{formatDateTime(row.last_login_at)}</TableCell>
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
              <Typography variant="h6" sx={{ mb: 1.2 }}>System Snapshot</Typography>
              <Typography variant="body2">DB Health: {overview?.db?.health || "-"}</Typography>
              <Typography variant="body2">Engine: {overview?.db?.engine || "-"}</Typography>
              <Typography variant="body2">Generated At: {formatDateTime(overview?.db?.generated_at)}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Users: {overview?.table_counts?.users_total ?? 0} | Profiles: {overview?.table_counts?.user_profiles_total ?? 0}
              </Typography>
              <Typography variant="body2">
                Sessions: {overview?.table_counts?.interview_sessions_total ?? 0} | Reports: {overview?.table_counts?.interview_reports_total ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.2 }}>Recent Sessions</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(overview?.recent_activity?.sessions || []).map((row) => (
                    <TableRow key={row.session_id}>
                      <TableCell>{row.name || row.email || row.clerk_user_id}</TableCell>
                      <TableCell>{formatAdminInterviewType(row.interview_type)}</TableCell>
                      <TableCell>{sessionStatusChip(row.status)}</TableCell>
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
              <Typography variant="h6" sx={{ mb: 1.2 }}>Recent Reports</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Capture</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(overview?.recent_activity?.reports || []).map((row) => (
                    <TableRow key={row.report_id}>
                      <TableCell>{row.name || row.email || row.clerk_user_id}</TableCell>
                      <TableCell>{row.overall_score ?? "-"}</TableCell>
                      <TableCell>{row.capture_status || "-"}</TableCell>
                      <TableCell>{row.evaluation_source || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.2 }}>Interview Metadata</Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Type</Typography>
              {renderDistribution(overview?.interview_metadata?.interview_type_distribution, { formatKey: formatAdminInterviewType })}
              <Typography variant="subtitle2" sx={{ mt: 1.2, mb: 0.5 }}>Difficulty</Typography>
              {renderDistribution(overview?.interview_metadata?.difficulty_distribution)}
              <Typography variant="subtitle2" sx={{ mt: 1.2, mb: 0.5 }}>Question Mix</Typography>
              {renderDistribution(overview?.interview_metadata?.question_mix_distribution)}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.2 }}>Quality & Top Metadata</Typography>
              <Typography variant="body2">Invalid Contracts: {overview?.quality?.invalid_contract_reports ?? 0}</Typography>
              <Typography variant="body2">Forced Zero: {overview?.quality?.zero_score_without_evidence_attempts_blocked ?? 0}</Typography>
              <Typography variant="subtitle2" sx={{ mt: 1.2, mb: 0.5 }}>Top Skills</Typography>
              {renderTopItems(overview?.interview_metadata?.selected_skills_top)}
              <Typography variant="subtitle2" sx={{ mt: 1.2, mb: 0.5 }}>Top Roles</Typography>
              {renderTopItems(overview?.interview_metadata?.target_roles_top)}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
