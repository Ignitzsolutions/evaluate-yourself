import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import { buildSearchParams, readStringParam } from "./adminSearchParams";
import {
  candidateStatusChip,
  compactText,
  formatAdminInterviewType,
  formatDateTime,
  loginRecencyChip,
} from "./adminUtils";

const statusOptions = ["all", "active", "inactive", "deleted"];
const recencyOptions = ["all", "today", "7d", "30d", "stale"];
const planTierOptions = ["all", "trial", "basic", "pro"];
const profileOptions = ["all", "completed", "missing"];

export default function AdminCandidatesPage() {
  const navigate = useNavigate();
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(() => readStringParam(searchParams, "q", ""));
  const [status, setStatus] = useState(() => readStringParam(searchParams, "status", "all"));
  const [profileFilter, setProfileFilter] = useState(() => readStringParam(searchParams, "profile", "all"));
  const [loginRecency, setLoginRecency] = useState(() => readStringParam(searchParams, "recency", "all"));
  const [planTier, setPlanTier] = useState(() => readStringParam(searchParams, "plan", "all"));
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);

  useEffect(() => {
    setSearchParams(
      buildSearchParams([
        ["q", query, ""],
        ["status", status, "all"],
        ["profile", profileFilter, "all"],
        ["recency", loginRecency, "all"],
        ["plan", planTier, "all"],
      ]),
      { replace: true },
    );
  }, [loginRecency, planTier, profileFilter, query, setSearchParams, status]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await requestJson(
          `/api/admin/candidates?page=1&page_size=100&q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`,
        );
        if (!mounted) return;
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        setItems(nextItems);
        setTotal(Number(data?.total || 0));
        setSelectedCandidateIds((prev) =>
          prev.filter((clerkUserId) => nextItems.some((row) => row.clerk_user_id === clerkUserId)),
        );
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load candidates.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [query, status, requestJson, setLastRefreshedAt, refreshTick, reloadKey]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (profileFilter === "completed" && !row.profile_completed) return false;
      if (profileFilter === "missing" && row.profile_completed) return false;
      if (loginRecency !== "all" && String(row.login_recency || "stale").toLowerCase() !== loginRecency) return false;
      const rowPlan = String(row.latest_plan_tier || row.current_entitlement?.plan_tier || "basic").toLowerCase();
      if (planTier !== "all" && rowPlan !== planTier) return false;
      return true;
    });
  }, [items, profileFilter, loginRecency, planTier]);

  useEffect(() => {
    setSelectedCandidateIds((prev) =>
      prev.filter((clerkUserId) => filteredItems.some((row) => row.clerk_user_id === clerkUserId)),
    );
  }, [filteredItems]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((row) => selectedCandidateIds.includes(row.clerk_user_id));

  const onDeactivate = async (clerkUserId) => {
    try {
      setError("");
      await requestJson(`/api/admin/candidates/${encodeURIComponent(clerkUserId)}/deactivate`, { method: "POST" });
      setNotice("Candidate deactivated.");
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to deactivate candidate.");
    }
  };

  const onDelete = async (clerkUserId) => {
    try {
      setError("");
      await requestJson(`/api/admin/candidates/${encodeURIComponent(clerkUserId)}`, { method: "DELETE" });
      setNotice("Candidate deleted and active entitlements revoked.");
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to delete candidate.");
    }
  };

  const onBulkAction = async (action) => {
    if (selectedCandidateIds.length === 0) return;
    try {
      setError("");
      const result = await requestJson("/api/admin/candidates/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_ids: selectedCandidateIds, action }),
      });
      setSelectedCandidateIds([]);
      setNotice(
        `${action === "delete" ? "Deleted" : "Deactivated"} ${result?.processed_count || 0} candidate(s).`,
      );
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || `Failed to ${action} selected candidates.`);
    }
  };

  const onExportCsv = async () => {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        export_type: "candidates",
        filters: {
          q: query || "",
          status,
          profileFilter,
          loginRecency,
          planTier,
          limit: 10000,
        },
        columns: [],
      };
      const result = await requestJson("/api/admin/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice(`CSV export created (${result?.row_count ?? 0} rows). Open Exports page to download.`);
      navigate(`/admin/dashboard/exports${result?.id ? `?highlight=${encodeURIComponent(result.id)}` : ""}`);
    } catch (e) {
      setError(e.message || "Failed to create export.");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setProfileFilter("all");
    setLoginRecency("all");
    setPlanTier("all");
  };

  const toggleCandidateSelection = (clerkUserId) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(clerkUserId) ? prev.filter((id) => id !== clerkUserId) : [...prev, clerkUserId],
    );
  };

  const toggleAllVisibleCandidates = () => {
    const visibleIds = filteredItems.map((row) => row.clerk_user_id);
    if (visibleIds.length === 0) return;
    setSelectedCandidateIds(allVisibleSelected ? [] : visibleIds);
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Search"
              placeholder="Name, email, phone, clerk id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="candidate-status">Status</InputLabel>
              <Select labelId="candidate-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="candidate-profile">Profile</InputLabel>
              <Select labelId="candidate-profile" label="Profile" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
                {profileOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="candidate-recency">Login Recency</InputLabel>
              <Select labelId="candidate-recency" label="Login Recency" value={loginRecency} onChange={(e) => setLoginRecency(e.target.value)}>
                {recencyOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="candidate-plan">Plan Tier</InputLabel>
              <Select labelId="candidate-plan" label="Plan Tier" value={planTier} onChange={(e) => setPlanTier(e.target.value)}>
                {planTierOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" onClick={clearFilters}>Clear Filters</Button>
            <Button size="small" variant="outlined" onClick={() => setReloadKey((v) => v + 1)}>Reload</Button>
            <Button size="small" variant="contained" onClick={onExportCsv} disabled={exporting}>
              {exporting ? "Creating CSV..." : "Export CSV"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="h6">
                Candidate Console ({filteredItems.length}/{total})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use bulk actions here for support workflows. Filters persist in the URL so views are shareable.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`${selectedCandidateIds.length} selected`} size="small" color={selectedCandidateIds.length ? "primary" : "default"} />
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={selectedCandidateIds.length === 0}
                onClick={() => onBulkAction("deactivate")}
              >
                Deactivate Selected
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={selectedCandidateIds.length === 0}
                onClick={() => onBulkAction("delete")}
              >
                Delete Selected
              </Button>
            </Stack>
          </Stack>

          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredItems.length === 0 ? (
            <Alert severity="info">No candidates match the current filters.</Alert>
          ) : (
            <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={allVisibleSelected}
                      indeterminate={selectedCandidateIds.length > 0 && !allVisibleSelected}
                      onChange={toggleAllVisibleCandidates}
                    />
                  </TableCell>
                  <TableCell>Candidate</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Registration / Login</TableCell>
                  <TableCell>Profile Metadata</TableCell>
                  <TableCell>Latest Interview Setup</TableCell>
                  <TableCell>Sessions / Reports</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((row) => (
                  <TableRow key={row.clerk_user_id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedCandidateIds.includes(row.clerk_user_id)}
                        onChange={() => toggleCandidateSelection(row.clerk_user_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.full_name || row.clerk_user_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{row.clerk_user_id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.email || "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.phone_e164 || "-"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">Registered: {formatDateTime(row.created_at)}</Typography>
                      <Typography variant="body2">Last login: {formatDateTime(row.last_login_at)}</Typography>
                      <Box sx={{ mt: 0.5 }}>{loginRecencyChip(row.login_recency)}</Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">Goal: {row.profile_primary_goal || "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">Roles: {compactText(row.profile_target_roles)}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Domain: {compactText(row.profile_domain_expertise)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.latest_interview_type ? formatAdminInterviewType(row.latest_interview_type) : "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.latest_session_status || "-"} | {formatDateTime(row.latest_session_started_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Role: {row.latest_role || "-"} | Company: {row.latest_company || "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Skills: {compactText(row.latest_selected_skills)}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.session_count} / {row.report_count}</TableCell>
                    <TableCell>{row.latest_plan_tier || row.current_entitlement?.plan_tier || "basic"}</TableCell>
                    <TableCell>{candidateStatusChip(row)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.8}>
                        <Button size="small" onClick={() => navigate(`/admin/dashboard/candidates/${encodeURIComponent(row.clerk_user_id)}`)}>
                          View
                        </Button>
                        <Button size="small" color="warning" onClick={() => onDeactivate(row.clerk_user_id)}>
                          Deactivate
                        </Button>
                        <Button size="small" color="error" onClick={() => onDelete(row.clerk_user_id)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
