import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  Typography,
} from "@mui/material";
import { authFetch } from "../../utils/apiClient";
import { useAdminApi } from "./useAdminApi";
import { formatDateTime } from "./adminUtils";

const exportTypes = ["all", "candidates", "interviews", "reports", "trials"];

export default function AdminExportsPage() {
  const { requestJson, apiBase } = useAdminApi();
  const { getToken } = useAuth();
  const { refreshTick, setLastRefreshedAt, tableDensity, triggerRefresh } = useOutletContext();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState([]);
  const [exportType, setExportType] = useState("all");
  const [downloadingId, setDownloadingId] = useState("");

  const query = useMemo(() => {
    return exportType === "all" ? "?page=1&page_size=50" : `?page=1&page_size=50&export_type=${encodeURIComponent(exportType)}`;
  }, [exportType]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await requestJson(`/api/admin/exports${query}`);
        if (!mounted) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load exports.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [query, requestJson, refreshTick, setLastRefreshedAt]);

  const handleDownload = async (row) => {
    setDownloadingId(row.id);
    setError("");
    setNotice("");
    try {
      const token = await getToken();
      const resp = await authFetch(`${apiBase}/api/admin/exports/${encodeURIComponent(row.id)}/download`, token, {
        method: "GET",
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Download failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.file_name || "export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Downloaded ${row.file_name || "export.csv"}`);
    } catch (e) {
      setError(e.message || "Failed to download export.");
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="exports-type">Export Type</InputLabel>
              <Select
                labelId="exports-type"
                label="Export Type"
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
              >
                {exportTypes.map((item) => (
                  <MenuItem key={item} value={item}>{item}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" onClick={triggerRefresh}>
              Refresh List
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              Exports are stored for 7 days (DB blob storage in current implementation).
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Exports</Typography>
          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Rows</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    selected={Boolean(highlightId && row.id === highlightId)}
                  >
                    <TableCell>{row.export_type}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.row_count ?? "-"}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.file_name || "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.id}</Typography>
                    </TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{formatDateTime(row.expires_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!row.has_download || downloadingId === row.id}
                        onClick={() => handleDownload(row)}
                      >
                        {downloadingId === row.id ? "Downloading..." : "Download CSV"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        No exports yet. Create one from Candidates, Interviews, Reports, or Trials pages.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
