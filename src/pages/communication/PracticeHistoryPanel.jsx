/**
 * PracticeHistoryPanel — compact progression card embedded above the practice
 * prompts. Renders avg score, attempts total, 7-day trend delta, daily
 * sparkline (Recharts), top quality flags, and per-pack rollup.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

const FLAG_LABELS = {
  LOW_PROMPT_COVERAGE: "Low coverage",
  STARTS_WITH_LOWERCASE: "No capitalization",
  MISSING_TERMINAL_PUNCTUATION: "No ending punctuation",
  TOO_SHORT: "Too short",
  HIGH_FILLER_DENSITY: "High filler",
  MODERATE_FILLER_DENSITY: "Moderate filler",
};

function formatFlag(flag) {
  return FLAG_LABELS[flag] || flag.replace(/_/g, " ").toLowerCase();
}

export default function PracticeHistoryPanel({ refreshKey = 0, days = 30 }) {
  const { getToken, isSignedIn } = useAuth();
  const base = useMemo(() => getApiBaseUrl(), []);
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const token = await getToken().catch(() => null);
        const res = await fetch(`${base}/api/communication-practice/history?days=${days}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) throw new Error(`history fetch failed (${res.status})`);
        const body = await res.json();
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Unable to load history.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, days, getToken, isSignedIn, refreshKey, retryCount]);

  if (!isSignedIn) return null;

  if (!data && !error) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton variant="text" width={180} height={28} />
          <Skeleton variant="rectangular" height={72} sx={{ mt: 1, borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => setRetryCount((value) => value + 1)}>
                Retry
              </Button>
            }
          >
            We couldn&apos;t load your practice history. Tap Retry, then complete one checked response to refresh your trend.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const scores = data?.attempts_by_day?.map((point) => point.avg_score).filter((value) => value != null) || [];
  const previous7dBaseline = scores.length >= 14
    ? Math.round((scores.slice(-14, -7).reduce((sum, value) => sum + value, 0) / 7) * 10) / 10
    : null;

  const trend = data.score_trend_7d;
  const TrendIcon = trend == null
    ? TrendingFlatIcon
    : trend > 0
    ? TrendingUpIcon
    : trend < 0
    ? TrendingDownIcon
    : TrendingFlatIcon;
  const trendColor = trend == null
    ? "text.secondary"
    : trend > 0
    ? "success.main"
    : trend < 0
    ? "error.main"
    : "text.secondary";

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {error ? (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => setRetryCount((value) => value + 1)}>
                Retry
              </Button>
            }
          >
            Couldn&apos;t refresh history. You can keep practicing below, then tap Retry to update this panel.
          </Alert>
        ) : null}
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ md: "center" }}>
          <Stack spacing={0.5} sx={{ minWidth: 160 }}>
            <Typography variant="overline" color="text.secondary">
              Your progress · {data.window_days}d
            </Typography>
            <Stack direction="row" spacing={2} alignItems="baseline">
              <Typography variant="h4" fontWeight={700}>
                {data.avg_score != null ? data.avg_score : "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                avg score
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: trendColor }}>
                <TrendIcon fontSize="small" />
                <Typography variant="body2" fontWeight={600}>
                  {trend == null ? "no trend yet" : `${trend > 0 ? "+" : ""}${trend} vs prev 7d`}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                · {data.attempts_total} attempts
              </Typography>
            </Stack>
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0, height: 84 }}>
            {data.attempts_by_day && data.attempts_by_day.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.attempts_by_day} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    dot={{ r: 2, fill: theme.palette.primary.main, stroke: theme.palette.primary.main }}
                    isAnimationActive={false}
                  />
                  {previous7dBaseline != null ? (
                    <ReferenceLine
                      y={previous7dBaseline}
                      stroke={theme.palette.text.secondary}
                      strokeDasharray="4 4"
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No trend yet. Check at least one response below, then use Retry here to load your progress.
              </Typography>
            )}
            {previous7dBaseline != null ? (
              <Typography variant="caption" color="text.secondary">
                Solid line: daily score · Dashed line: previous 7-day baseline ({previous7dBaseline})
              </Typography>
            ) : null}
          </Box>

          {data.top_quality_flags && data.top_quality_flags.length > 0 ? (
            <Stack spacing={0.5} sx={{ minWidth: 180 }}>
              <Typography variant="overline" color="text.secondary">
                Most common issues
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap rowGap={0.5}>
                {data.top_quality_flags.slice(0, 4).map((f) => (
                  <Chip
                    key={f.flag}
                    label={`${formatFlag(f.flag)} · ${f.count}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
