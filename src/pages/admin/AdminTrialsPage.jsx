import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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
  TextField,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import { formatDateTime } from "./adminUtils";

export default function AdminTrialsPage() {
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [trialCodes, setTrialCodes] = useState([]);
  const [trialSuffixFilter, setTrialSuffixFilter] = useState("");
  const [trialCodeInput, setTrialCodeInput] = useState({
    duration_minutes: 5,
    expires_in_days: 7,
    note: "",
    code_suffix: "",
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const suffix = trialSuffixFilter.trim()
          ? `&suffix=${encodeURIComponent(trialSuffixFilter.trim().toUpperCase())}`
          : "";
        const [overviewData, trialData] = await Promise.all([
          requestJson("/api/admin/dashboard/overview"),
          requestJson(`/api/admin/trial-codes?page=1&page_size=100${suffix}`),
        ]);
        if (!mounted) return;
        setOverview(overviewData);
        setTrialCodes(trialData?.items || []);
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
  }, [refreshTick, requestJson, setLastRefreshedAt, reloadKey, trialSuffixFilter]);

  const onCreateTrialCode = async () => {
    try {
      const payload = {
        duration_minutes: Number(trialCodeInput.duration_minutes) || 5,
        expires_in_days: Number(trialCodeInput.expires_in_days) || 7,
        note: trialCodeInput.note || "",
        code_suffix: (trialCodeInput.code_suffix || "").trim().toUpperCase() || null,
      };
      await requestJson("/api/admin/trial-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTrialCodeInput({ duration_minutes: 5, expires_in_days: 7, note: "", code_suffix: "" });
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to create trial code.");
    }
  };

  const onDeleteTrialCode = async (codeId) => {
    try {
      await requestJson(`/api/admin/trial-codes/${encodeURIComponent(codeId)}`, { method: "DELETE" });
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to delete/revoke trial code.");
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.2 }}>Trial Operations</Typography>
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
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
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
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.5 }}>
            <Typography variant="h6">Trial Codes ({trialCodes.length})</Typography>
            <TextField
              size="small"
              label="Filter by suffix"
              value={trialSuffixFilter}
              onChange={(e) => setTrialSuffixFilter(e.target.value.toUpperCase())}
              sx={{ width: 220 }}
            />
          </Stack>

          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
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
                      <Button size="small" color="error" onClick={() => onDeleteTrialCode(row.id)}>
                        Delete/Revoke
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
