import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
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
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useAdminApi } from "./useAdminApi";
import { connectAdminLiveStream } from "../../utils/adminLiveStream";
import { formatDateTime } from "./adminUtils";

const fmtUsd = (v) => `$${(Number(v) || 0).toFixed(4)}`;
const fmtInt = (v) => (Number(v) || 0).toLocaleString();

export default function AdminLiveOpsPage() {
  const { requestJson } = useAdminApi();
  const { getToken } = useAuth();
  const { refreshTick, setLastRefreshedAt } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokensSummary, setTokensSummary] = useState(null);
  const [tokensSeries, setTokensSeries] = useState([]);
  const [liveUsers, setLiveUsers] = useState([]);
  const [streamStatus, setStreamStatus] = useState("connecting");
  const [recentUsage, setRecentUsage] = useState([]);
  const liveUsersRef = useRef(new Map());

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, series, active] = await Promise.all([
        requestJson("/api/admin/tokens/summary?days=7"),
        requestJson("/api/admin/tokens/timeseries?days=14"),
        requestJson("/api/admin/live/active-users?window_seconds=60&limit=200"),
      ]);
      setTokensSummary(summary);
      setTokensSeries(series?.series || []);
      const items = Array.isArray(active?.items) ? active.items : [];
      liveUsersRef.current = new Map(items.map((u) => [u.user_id, u]));
      setLiveUsers(items);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e?.message || "Failed to load live ops data.");
    } finally {
      setLoading(false);
    }
  }, [requestJson, setLastRefreshedAt]);

  useEffect(() => { refreshAll(); }, [refreshAll, refreshTick]);

  // Live SSE stream
  useEffect(() => {
    const handle = connectAdminLiveStream({
      getAuthToken: async () => (await getToken().catch(() => null)) || null,
      onStatus: (s) => setStreamStatus(s),
      onEvent: (evt, data) => {
        if (evt === "presence") {
          if (data?.type === "offline" && data.user_id) {
            liveUsersRef.current.delete(data.user_id);
          } else if (data?.user_id) {
            liveUsersRef.current.set(data.user_id, {
              user_id: data.user_id,
              email: data.email,
              route: data.route,
              session_id: data.session_id,
              last_seen_ms: data.last_seen_ms || Date.now(),
            });
          }
          setLiveUsers(Array.from(liveUsersRef.current.values())
            .sort((a, b) => (b.last_seen_ms || 0) - (a.last_seen_ms || 0)));
        } else if (evt === "usage") {
          setRecentUsage((prev) => [{ ...data, _ts: Date.now() }, ...prev].slice(0, 50));
        }
      },
    });
    return () => handle.close();
  }, [getToken]);

  // Prune stale live users every 30s based on last_seen_ms
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 90_000;
      let changed = false;
      for (const [k, v] of liveUsersRef.current) {
        if ((v.last_seen_ms || 0) < cutoff) {
          liveUsersRef.current.delete(k);
          changed = true;
        }
      }
      if (changed) setLiveUsers(Array.from(liveUsersRef.current.values()));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const byModel = tokensSummary?.by_model || [];
  const byRoute = tokensSummary?.by_route || [];
  const topUsers = tokensSummary?.top_users || [];

  const kpis = useMemo(() => {
    const t = tokensSummary?.totals || {};
    return [
      ["Live users (60s)", liveUsers.length],
      ["Tokens (7d)", fmtInt(t.tokens)],
      ["Spend (7d)", fmtUsd(t.est_cost_usd)],
      ["Audio min (7d)", ((Number(t.audio_seconds) || 0) / 60).toFixed(1)],
      ["API calls (7d)", fmtInt(t.events)],
    ];
  }, [liveUsers.length, tokensSummary]);

  if (loading && !tokensSummary) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Live Ops</Typography>
        <Chip
          size="small"
          label={`stream: ${streamStatus}`}
          color={streamStatus === "connected" ? "success" : streamStatus === "error" ? "error" : "default"}
        />
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {kpis.map(([label, value]) => (
          <Grid item xs={12} sm={6} md={2.4} key={label}>
            <Card><CardContent>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Card><CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Spend (14d)</Typography>
        <Box sx={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={tokensSeries}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="est_cost_usd" stroke="#1976d2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent></Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Active users (live)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Session</TableCell>
                  <TableCell>Last seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {liveUsers.length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center">No one online right now</TableCell></TableRow>
                )}
                {liveUsers.slice(0, 50).map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.email || u.user_id}</TableCell>
                    <TableCell>{u.route || "—"}</TableCell>
                    <TableCell>{u.session_id ? u.session_id.slice(0, 8) : "—"}</TableCell>
                    <TableCell>{u.last_seen_ms ? formatDateTime(new Date(u.last_seen_ms).toISOString()) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Top spenders (7d)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Est. cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topUsers.length === 0 && (
                  <TableRow><TableCell colSpan={3} align="center">No usage recorded</TableCell></TableRow>
                )}
                {topUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.user_id}</TableCell>
                    <TableCell align="right">{fmtInt(u.tokens)}</TableCell>
                    <TableCell align="right">{fmtUsd(u.est_cost_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>By model (7d)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Model</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Calls</TableCell>
                  <TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byModel.map((r) => (
                  <TableRow key={r.model}>
                    <TableCell>{r.model}</TableCell>
                    <TableCell align="right">{fmtInt(r.tokens)}</TableCell>
                    <TableCell align="right">{fmtInt(r.events)}</TableCell>
                    <TableCell align="right">{fmtUsd(r.est_cost_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>By route (7d)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Route</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Calls</TableCell>
                  <TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byRoute.map((r) => (
                  <TableRow key={r.route}>
                    <TableCell>{r.route}</TableCell>
                    <TableCell align="right">{fmtInt(r.tokens)}</TableCell>
                    <TableCell align="right">{fmtInt(r.events)}</TableCell>
                    <TableCell align="right">{fmtUsd(r.est_cost_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card><CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Recent usage (live)</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>Model</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentUsage.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">No live events yet</TableCell></TableRow>
            )}
            {recentUsage.map((u, i) => (
              <TableRow key={i}>
                <TableCell>{new Date(u._ts).toLocaleTimeString()}</TableCell>
                <TableCell>{u.route}</TableCell>
                <TableCell>{u.model}</TableCell>
                <TableCell align="right">{fmtInt(u.tokens)}</TableCell>
                <TableCell align="right">{fmtUsd(u.est_cost_usd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
