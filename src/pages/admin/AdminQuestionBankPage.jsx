import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";

const emptyTrackForm = { label: "", description: "", is_active: true };
const emptyQuestionForm = { text: "", is_active: true };

export default function AdminQuestionBankPage() {
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt, tableDensity } = useOutletContext();
  const [vertical, setVertical] = useState("technical");
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [trackFilter, setTrackFilter] = useState("");
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [trackDialogMode, setTrackDialogMode] = useState("create");
  const [trackDialogTarget, setTrackDialogTarget] = useState(null);
  const [trackForm, setTrackForm] = useState(emptyTrackForm);

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionDialogMode, setQuestionDialogMode] = useState("create");
  const [questionDialogTarget, setQuestionDialogTarget] = useState(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);

  const filteredTracks = useMemo(() => {
    const needle = trackFilter.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) => {
      const label = String(track.label || "").toLowerCase();
      const desc = String(track.description || "").toLowerCase();
      return label.includes(needle) || desc.includes(needle);
    });
  }, [tracks, trackFilter]);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) || null,
    [tracks, selectedTrackId],
  );

  const loadTracks = async () => {
    setLoadingTracks(true);
    setError("");
    try {
      const data = await requestJson(`/api/admin/question-bank/tracks?interview_type=${encodeURIComponent(vertical)}`);
      const items = Array.isArray(data?.items) ? data.items : [];
      setTracks(items);
      setSelectedTrackId((prev) => {
        if (prev && items.some((t) => t.id === prev)) return prev;
        const preferred = items.find((t) => t.is_active) || items[0];
        return preferred?.id || "";
      });
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setTracks([]);
      setSelectedTrackId("");
      setError(e.message || "Failed to load tracks.");
    } finally {
      setLoadingTracks(false);
    }
  };

  const loadQuestions = async (trackId) => {
    if (!trackId) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    setError("");
    try {
      const data = await requestJson(
        `/api/admin/question-bank/questions?track_id=${encodeURIComponent(trackId)}&interview_type=${encodeURIComponent(vertical)}&include_inactive=true`,
      );
      setQuestions(Array.isArray(data?.items) ? data.items : []);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setQuestions([]);
      setError(e.message || "Failed to load questions.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, [vertical, refreshTick, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadQuestions(selectedTrackId);
  }, [selectedTrackId, vertical]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateTrack = () => {
    setTrackDialogMode("create");
    setTrackDialogTarget(null);
    setTrackForm({ ...emptyTrackForm });
    setTrackDialogOpen(true);
  };

  const openEditTrack = (track) => {
    setTrackDialogMode("edit");
    setTrackDialogTarget(track);
    setTrackForm({
      label: track?.label || "",
      description: track?.description || "",
      is_active: Boolean(track?.is_active),
    });
    setTrackDialogOpen(true);
  };

  const submitTrack = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        label: trackForm.label,
        description: trackForm.description,
        is_active: Boolean(trackForm.is_active),
      };
      if (trackDialogMode === "create") {
        await requestJson("/api/admin/question-bank/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, track_type: vertical }),
        });
      } else {
        await requestJson(`/api/admin/question-bank/tracks/${encodeURIComponent(trackDialogTarget.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setTrackDialogOpen(false);
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to save track.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateQuestion = () => {
    if (!selectedTrack) return;
    setQuestionDialogMode("create");
    setQuestionDialogTarget(null);
    setQuestionForm({ ...emptyQuestionForm });
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (question) => {
    setQuestionDialogMode("edit");
    setQuestionDialogTarget(question);
    setQuestionForm({
      text: question?.text || "",
      is_active: Boolean(question?.is_active),
    });
    setQuestionDialogOpen(true);
  };

  const submitQuestion = async () => {
    if (!selectedTrack && questionDialogMode === "create") return;
    setSaving(true);
    setError("");
    try {
      if (questionDialogMode === "create") {
        await requestJson("/api/admin/question-bank/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track_id: selectedTrack.id,
            interview_type: vertical,
            text: questionForm.text,
            is_active: Boolean(questionForm.is_active),
          }),
        });
      } else if (questionDialogTarget?.source_kind === "builtin") {
        await requestJson(`/api/admin/question-bank/builtin-questions/${encodeURIComponent(questionDialogTarget.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: questionForm.text,
            is_active: Boolean(questionForm.is_active),
          }),
        });
      } else {
        await requestJson(`/api/admin/question-bank/custom-questions/${encodeURIComponent(questionDialogTarget.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: questionForm.text,
            is_active: Boolean(questionForm.is_active),
          }),
        });
      }
      setQuestionDialogOpen(false);
      await loadQuestions(selectedTrackId);
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTrackActive = async (track) => {
    try {
      await requestJson(`/api/admin/question-bank/tracks/${encodeURIComponent(track.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !track.is_active }),
      });
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to update track status.");
    }
  };

  const toggleQuestionActive = async (question) => {
    try {
      const path =
        question.source_kind === "builtin"
          ? `/api/admin/question-bank/builtin-questions/${encodeURIComponent(question.id)}`
          : `/api/admin/question-bank/custom-questions/${encodeURIComponent(question.id)}`;
      await requestJson(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !question.is_active }),
      });
      await loadQuestions(selectedTrackId);
      setReloadKey((v) => v + 1);
    } catch (e) {
      setError(e.message || "Failed to update question status.");
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
            <Box>
              <Typography variant="h6">Question Bank</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage technical and behavioral master questions by skill/stream.
              </Typography>
            </Box>
            <Button variant="outlined" size="small" onClick={() => setReloadKey((v) => v + 1)}>
              Reload
            </Button>
          </Stack>
          <Tabs
            value={vertical}
            onChange={(_, next) => setVertical(next)}
            sx={{ mt: 1.5 }}
          >
            <Tab label="Technical" value="technical" />
            <Tab label="Behavioral" value="behavioral" />
          </Tabs>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Skills / Streams</Typography>
                <Button size="small" variant="contained" onClick={openCreateTrack}>
                  Add Skill
                </Button>
              </Stack>
              <TextField
                size="small"
                fullWidth
                label="Filter skills"
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                sx={{ mb: 1.2 }}
              />
              {loadingTracks ? (
                <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense sx={{ p: 0 }}>
                  {filteredTracks.map((track, idx) => (
                    <Box key={track.id}>
                      {idx > 0 && <Divider />}
                      <ListItemButton
                        selected={track.id === selectedTrackId}
                        onClick={() => setSelectedTrackId(track.id)}
                        alignItems="flex-start"
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {track.label}
                              </Typography>
                              <Chip size="small" label={track.source_kind === "custom" ? "Custom" : "System"} />
                              <Chip
                                size="small"
                                color={track.is_active ? "success" : "default"}
                                variant={track.is_active ? "filled" : "outlined"}
                                label={track.is_active ? "Active" : "Inactive"}
                              />
                            </Stack>
                          }
                          secondary={
                            <Box sx={{ mt: 0.4 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {track.description || "No description"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Builtin: {track?.counts?.builtin_questions ?? 0} | Custom: {track?.counts?.custom_questions ?? 0} | Active: {track?.counts?.active_total ?? 0}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.6 }}>
                                <Button size="small" onClick={(e) => { e.stopPropagation(); openEditTrack(track); }}>
                                  Edit
                                </Button>
                                <Button size="small" onClick={(e) => { e.stopPropagation(); toggleTrackActive(track); }}>
                                  {track.is_active ? "Disable" : "Enable"}
                                </Button>
                              </Stack>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </Box>
                  ))}
                  {!filteredTracks.length && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No skills found.
                    </Typography>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 1.2 }}>
                <Box>
                  <Typography variant="h6">
                    Questions {selectedTrack ? `• ${selectedTrack.label}` : ""}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Edit builtin question text/status or add custom questions under the selected skill.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={openCreateQuestion}
                  disabled={!selectedTrack}
                >
                  Add Question
                </Button>
              </Stack>

              {!selectedTrack ? (
                <Typography variant="body2" color="text.secondary">Select a skill to view questions.</Typography>
              ) : loadingQuestions ? (
                <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Table size={tableDensity === "comfortable" ? "medium" : "small"}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Source</TableCell>
                      <TableCell>Question</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Meta</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={`${q.source_kind}:${q.id}`}>
                        <TableCell>
                          <Chip
                            size="small"
                            label={q.source_kind === "builtin" ? "Builtin" : "Custom"}
                            variant={q.source_kind === "builtin" ? "outlined" : "filled"}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 520 }}>
                          <Typography variant="body2">{q.text}</Typography>
                          {q.overridden ? (
                            <Typography variant="caption" color="text.secondary">Override applied</Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={q.is_active ? "success" : "default"}
                            variant={q.is_active ? "filled" : "outlined"}
                            label={q.is_active ? "Active" : "Inactive"}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {q.domain || "-"} / {q.difficulty || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => openEditQuestion(q)}>Edit</Button>
                            <Button size="small" onClick={() => toggleQuestionActive(q)}>
                              {q.is_active ? "Disable" : "Enable"}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!questions.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No questions found for this skill.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={trackDialogOpen} onClose={() => !saving && setTrackDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{trackDialogMode === "create" ? "Add Skill / Stream" : "Edit Skill / Stream"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Label"
              value={trackForm.label}
              onChange={(e) => setTrackForm((prev) => ({ ...prev, label: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={trackForm.description}
              onChange={(e) => setTrackForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={trackForm.is_active}
                  onChange={(e) => setTrackForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrackDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submitTrack} variant="contained" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={questionDialogOpen} onClose={() => !saving && setQuestionDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{questionDialogMode === "create" ? "Add Question" : "Edit Question"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Question Text"
              value={questionForm.text}
              onChange={(e) => setQuestionForm((prev) => ({ ...prev, text: e.target.value }))}
              fullWidth
              required
              multiline
              minRows={3}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={questionForm.is_active}
                  onChange={(e) => setQuestionForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuestionDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submitQuestion} variant="contained" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

