import React, { useEffect, useState } from "react";
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
  FormControlLabel,
  Grid,
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
import { useAdminApi } from "./useAdminApi";
import { buildSearchParams, readBoolParam, readStringParam } from "./adminSearchParams";
import { formatDateTime, formatExpiryDateTime, trialStatusChip } from "./adminUtils";

export default function AdminTrialsPage() {
  const navigate = useNavigate();
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [trialCodes, setTrialCodes] = useState([]);
  const [trialQueryFilter, setTrialQueryFilter] = useState(() => readStringParam(searchParams, "q", ""));
  const [trialSuffixFilter, setTrialSuffixFilter] = useState(() => readStringParam(searchParams, "suffix", ""));
  const [showDeleted, setShowDeleted] = useState(() => readBoolParam(searchParams, "deleted", false));
  const [trialCodeInput, setTrialCodeInput] = useState({
    display_name: "",
    duration_minutes: 5,
    note: "",
    code_suffix: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedTrialIds, setSelectedTrialIds] = useState([]);

  useEffect(() => {
    setSearchParams(
      buildSearchParams([
        ["q", trialQueryFilter, ""],
        ["suffix", trialSuffixFilter, ""],
        ["deleted", showDeleted ? "1" : "", ""],
      ]),
      { replace: true },
    );
  }, [setSearchParams, showDeleted, trialQueryFilter, trialSuffixFilter]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const suffix = trialSuffixFilter.trim()
          ? `&suffix=${encodeURIComponent(trialSuffixFilter.trim().toUpperCase())}`
          : "";
        const q = trialQueryFilter.trim()
          ? `&q=${encodeURIComponent(trialQueryFilter.trim())}`
          : "";
        const includeDeleted = showDeleted ? "&include_deleted=true" : "";
        const [overviewData, trialData] = await Promise.all([
          requestJson("/api/admin/dashboard/overview"),
          requestJson(`/api/admin/trial-codes?page=1&page_size=100${includeDeleted}${suffix}${q}`),
        ]);
        if (!mounted) return;
        setOverview(overviewData);
        setTrialCodes(trialData?.items || []);
        setSelectedTrialIds((prev) =>
          prev.filter((trialId) => (trialData?.items || []).some((row) => row.id === trialId)),
        );
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load trial data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [refreshTick, requestJson, setLastRefreshedAt, reloadKey, showDeleted, trialSuffixFilter, trialQueryFilter]);

  const onCreateTrialCode = async () => {
    try {
      setError("");
      const payload = {
        display_name: (trialCodeInput.display_name || "").trim() || null,
        duration_minutes: Number(trialCodeInput.duration_minutes) || 5,
        note: trialCodeInput.note || "",
        code_suffix: (trialCodeInput.code_suffix || "").trim().toUpperCase() || null,
      };
      await requestJson("/api/admin/trial-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTrialCodeInput({ display_name: "", duration_minutes: 5, note: "", code_suffix: "" });
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to create trial code.");
    }
  };

  const onDeleteTrialCode = async (codeId) => {
    try {
      setError("");
      await requestJson(`/api/admin/trial-codes/${encodeURIComponent(codeId)}`, { method: "DELETE" });
      setTrialCodes((prev) => prev.filter((row) => row.id !== codeId));
      setSelectedTrialIds((prev) => prev.filter((id) => id !== codeId));
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to delete/revoke trial code.");
    }
  };

  const onToggleTrialSelection = (trialId) => {
    setSelectedTrialIds((prev) =>
      prev.includes(trialId) ? prev.filter((id) => id !== trialId) : [...prev, trialId],
    );
  };

  const onToggleAllVisibleTrials = () => {
    if (selectableTrialIds.length === 0) return;
    const everySelected = selectableTrialIds.every((trialId) => selectedTrialIds.includes(trialId));
    setSelectedTrialIds(everySelected ? [] : selectableTrialIds);
  };

  const onBulkDeleteTrials = async () => {
    if (selectedTrialIds.length === 0) return;
    try {
      setError("");
      await requestJson("/api/admin/trial-codes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_ids: selectedTrialIds }),
      });
      setSelectedTrialIds([]);
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to delete selected trial codes.");
    }
  };

  const onClearFilters = () => {
    setTrialQueryFilter("");
    setTrialSuffixFilter("");
    setShowDeleted(false);
    setSelectedTrialIds([]);
  };

  const selectableTrialIds = trialCodes.filter((row) => row.status !== "DELETED").map((row) => row.id);
  const allVisibleSelected =
    selectableTrialIds.length > 0 && selectableTrialIds.every((trialId) => selectedTrialIds.includes(trialId));

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.2 }}>Trial Operations</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ mb: 1.2 }}>
            <Typography variant="body2" color="text.secondary">
              Use the dedicated trials console for creation, filtering, export, and bulk revocation.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => navigate("/admin/dashboard/exports?type=trials")}>
                Open Exports
              </Button>
            </Stack>
          </Stack>
          <Grid container spacing={1.2}>
            {Object.entries(overview?.trials || {}).map(([key, value]) => (
              <Grid item xs={6} md={3} key={key}>
                <Typography variant="caption" color="text.secondary">{key}</Typography>
                <Typography variant="h6">{String(value ?? 0)}</Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Create Trial Code</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Trial codes remain active until you explicitly revoke or delete them.
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              size="small"
              label="Display Name"
              placeholder="Spring Campaign"
              value={trialCodeInput.display_name}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, display_name: e.target.value }))}
              helperText="Readable admin label"
            />
            <TextField
              size="small"
              type="number"
              label="Duration minutes"
              value={trialCodeInput.duration_minutes}
              onChange={(e) => setTrialCodeInput((prev) => ({ ...prev, duration_minutes: Number(e.target.value) || 5 }))}
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
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.5 }}>
            <Typography variant="h6">Trial Codes ({trialCodes.length})</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
              <TextField
                size="small"
                label="Search trial codes"
                placeholder="Name, code, redeemed by"
                value={trialQueryFilter}
                onChange={(e) => setTrialQueryFilter(e.target.value)}
                sx={{ width: 240 }}
              />
              <TextField
                size="small"
                label="Filter by suffix"
                value={trialSuffixFilter}
                onChange={(e) => setTrialSuffixFilter(e.target.value.toUpperCase())}
                sx={{ width: 220 }}
              />
              <FormControlLabel
                control={<Switch checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />}
                label="Show deleted"
              />
              <Button size="small" variant="outlined" onClick={onClearFilters}>
                Clear
              </Button>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Chip label="Non-expiring by default" color="success" size="small" variant="outlined" />
            <Chip label="Delete/Revoke immediately deactivates live entitlement" size="small" variant="outlined" />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedTrialIds.length > 0
                ? `${selectedTrialIds.length} trial code(s) selected`
                : "Select rows to delete multiple trial codes at once."}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={selectedTrialIds.length === 0}
                onClick={onBulkDeleteTrials}
              >
                Delete Selected
              </Button>
            </Stack>
          </Stack>

          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : trialCodes.length === 0 ? (
            <Alert severity="info">No trial codes match the current filter.</Alert>
          ) : (
            <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={selectedTrialIds.length > 0 && !allVisibleSelected}
                      onChange={onToggleAllVisibleTrials}
                    />
                  </TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Suffix</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Redeemed By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Deleted</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trialCodes.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        disabled={row.status === "DELETED"}
                        checked={selectedTrialIds.includes(row.id)}
                        onChange={() => onToggleTrialSelection(row.id)}
                      />
                    </TableCell>
                    <TableCell>{row.display_name || "-"}</TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.note || "-"}</TableCell>
                    <TableCell>{row.code_suffix || "-"}</TableCell>
                    <TableCell>{trialStatusChip(row.status)}</TableCell>
                    <TableCell>{row.duration_minutes}m</TableCell>
                    <TableCell>{row.redeemed_by_clerk_user_id || "-"}</TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{formatExpiryDateTime(row.expires_at)}</TableCell>
                    <TableCell>{formatDateTime(row.deleted_at)}</TableCell>
                    <TableCell>
                      <Button size="small" color="error" onClick={() => onDeleteTrialCode(row.id)} disabled={row.status === "DELETED"}>
                        Delete
                      </Button>
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
