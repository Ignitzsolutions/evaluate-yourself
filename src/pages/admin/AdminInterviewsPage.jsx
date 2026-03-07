import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
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
  TextField,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import { compactText, formatAdminInterviewType, formatDateTime, sessionStatusChip } from "./adminUtils";

const statusOptions = ["all", "ACTIVE", "COMPLETED", "FAILED"];
const typeOptions = ["all", "technical", "behavioral", "mixed"];

export default function AdminInterviewsPage() {
  const navigate = useNavigate();
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity, defaultWindowDays } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeUsersNow, setActiveUsersNow] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [interviewType, setInterviewType] = useState("all");
  const [windowDays, setWindowDays] = useState(defaultWindowDays || 30);
  const [skill, setSkill] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [interviewsData, activeUsersData] = await Promise.all([
          requestJson(
            `/api/admin/interviews?page=1&page_size=100&status=${encodeURIComponent(status)}&interview_type=${encodeURIComponent(interviewType)}&q=${encodeURIComponent(query)}&window_days=${encodeURIComponent(windowDays)}&skill=${encodeURIComponent(skill)}`,
          ),
          requestJson("/api/admin/active-users?window_minutes=15&page=1&page_size=10"),
        ]);
        if (!mounted) return;
        setItems(interviewsData?.items || []);
        setTotal(interviewsData?.total || 0);
        setActiveUsersNow(activeUsersData?.count_now || 0);
        setLastRefreshedAt(new Date().toISOString());
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load interviews.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [requestJson, refreshTick, setLastRefreshedAt, reloadKey, status, interviewType, query, windowDays, skill]);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              size="small"
              label="Search"
              placeholder="Session id / user / email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="interview-status">Status</InputLabel>
              <Select labelId="interview-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="interview-type">Type</InputLabel>
              <Select labelId="interview-type" label="Type" value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                {typeOptions.map((item) => <MenuItem key={item} value={item}>{item === "all" ? "all" : formatAdminInterviewType(item)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Window days" type="number" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value) || 30)} sx={{ width: 140 }} />
            <TextField size="small" label="Skill filter" value={skill} onChange={(e) => setSkill(e.target.value)} sx={{ minWidth: 160 }} />
            <Button size="small" variant="outlined" onClick={() => setReloadKey((v) => v + 1)}>Reload</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" sx={{ mb: 1.2 }}>
            <Typography variant="h6">Interviews ({total})</Typography>
            <Typography variant="body2">Active users now: {activeUsersNow}</Typography>
          </Stack>
          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
              <TableHead>
                <TableRow>
                  <TableCell>Session</TableCell>
                  <TableCell>Candidate</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Type / Difficulty</TableCell>
                  <TableCell>Setup</TableCell>
                  <TableCell>Capture / Source</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.session_id}>
                    <TableCell>{row.session_id}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.name || row.email || row.clerk_user_id}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.email || row.phone_e164 || "-"}</Typography>
                    </TableCell>
                    <TableCell>{sessionStatusChip(row.status)}</TableCell>
                    <TableCell>{formatAdminInterviewType(row.interview_type) || "-"} / {row.difficulty || "-"}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.question_mix || "-"} | {row.interview_style || "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.role || "-"} @ {row.company || "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Skills: {compactText(row.selected_skills)}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.capture_status || "-"} / {row.evaluation_source || "-"}</TableCell>
                    <TableCell>{row.overall_score ?? "-"}</TableCell>
                    <TableCell>{formatDateTime(row.started_at)}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/admin/dashboard/candidates/${encodeURIComponent(row.clerk_user_id)}`)}>
                        Candidate
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
