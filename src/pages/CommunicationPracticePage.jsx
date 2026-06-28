import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Mic, Stop, Refresh, PlayArrow } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import PracticeHistoryPanel from "./communication/PracticeHistoryPanel";

const API_BASE = getApiBaseUrl();

const getSpeechRecognitionCtor = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export default function CommunicationPracticePage() {
  const { getToken } = useAuth();

  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [completedPromptIds, setCompletedPromptIds] = useState([]);
  const [spokenText, setSpokenText] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const voiceStartAtRef = useRef(0);
  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const fetchNextPrompt = useCallback(async (packId, flags = [], completed = []) => {
    if (!packId) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await authFetch(`${API_BASE}/api/communication-practice/next-prompt`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: packId,
          quality_flags: flags,
          completed_prompt_ids: completed,
        }),
      });
      if (!response.ok) {
        throw await buildApiErrorFromResponse(response, {
          defaultMessage: "Could not fetch the next practice sentence.",
        });
      }
      const data = await response.json();
      setCurrentPrompt(data.next_prompt || null);
      setSpokenText("");
      setDurationSeconds(0);
      setResult(null);
    } catch (err) {
      setError(getApiErrorMessage(err, { defaultMessage: "Could not load practice prompt." }));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    let mounted = true;
    const loadPacks = async () => {
      setLoading(true);
      setError("");
      try {
        const token = await getToken();
        const response = await authFetch(`${API_BASE}/api/communication-practice/packs`, token, { method: "GET" });
        if (!response.ok) {
          throw await buildApiErrorFromResponse(response, {
            defaultMessage: "Could not load communication practice packs.",
          });
        }
        const data = await response.json();
        if (!mounted) return;
        const catalog = Array.isArray(data.packs) ? data.packs : [];
        setPacks(catalog);
        if (catalog.length > 0) {
          setSelectedPackId(catalog[0].id);
        }
      } catch (err) {
        if (!mounted) return;
        setError(getApiErrorMessage(err, { defaultMessage: "Could not load communication practice packs." }));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPacks();
    return () => {
      mounted = false;
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
      }
    };
  }, [getToken]);

  useEffect(() => {
    if (!selectedPackId) return;
    setCompletedPromptIds([]);
    fetchNextPrompt(selectedPackId, [], []);
  }, [selectedPackId, fetchNextPrompt]);

  const startVoiceCapture = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setError("Browser speech recognition is unavailable. Type manually or use a supported browser.");
      return;
    }
    setError("");
    setResult(null);

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      voiceStartAtRef.current = Date.now();
    };
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || "";
      setSpokenText(String(transcript).trim());
    };
    recognition.onerror = () => {
      setError("Voice capture failed. Try again or type your sentence manually.");
    };
    recognition.onend = () => {
      setListening(false);
      if (voiceStartAtRef.current > 0) {
        setDurationSeconds(Math.max(1, Math.round((Date.now() - voiceStartAtRef.current) / 1000)));
      }
      voiceStartAtRef.current = 0;
    };
    recognition.start();
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const evaluateAttempt = async () => {
    if (!currentPrompt) return;
    if (!spokenText.trim()) {
      setError("Speak or type your response before evaluation.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await authFetch(`${API_BASE}/api/communication-practice/evaluate-turn`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: selectedPackId,
          prompt_id: currentPrompt.id,
          target_sentence: currentPrompt.sentence,
          spoken_text: spokenText,
          duration_seconds: durationSeconds || undefined,
        }),
      });
      if (!response.ok) {
        throw await buildApiErrorFromResponse(response, {
          defaultMessage: "Could not evaluate this speaking attempt.",
        });
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, { defaultMessage: "Could not evaluate this attempt." }));
    } finally {
      setLoading(false);
    }
  };

  const nextPrompt = async () => {
    if (!currentPrompt) return;
    const nextCompleted = Array.from(new Set([...completedPromptIds, currentPrompt.id]));
    setCompletedPromptIds(nextCompleted);
    await fetchNextPrompt(selectedPackId, result?.quality_flags || [], nextCompleted);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Communication Practice</Typography>
        <Typography color="text.secondary">
          Voice-first guided speaking drills with instant grammar and fluency coaching.
        </Typography>
      </Stack>

      <PracticeHistoryPanel refreshKey={result?.created_at || result?.score || 0} />

      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Practice pack</Typography>
              <Select
                fullWidth
                value={selectedPackId}
                onChange={(event) => setSelectedPackId(event.target.value)}
                disabled={loading || packs.length === 0}
              >
                {packs.map((pack) => (
                  <MenuItem key={pack.id} value={pack.id}>
                    {pack.title} ({pack.prompt_count} prompts)
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Target sentence</Typography>
              <Typography sx={{ p: 2, borderRadius: 2, bgcolor: "grey.100" }}>
                {currentPrompt?.sentence || "No prompt available in this pack."}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                startIcon={listening ? <Stop /> : <Mic />}
                onClick={listening ? stopVoiceCapture : startVoiceCapture}
                disabled={loading || !speechSupported}
              >
                {listening ? "Stop capture" : "Start voice capture"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={evaluateAttempt}
                disabled={loading || !currentPrompt}
              >
                Evaluate attempt
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={nextPrompt}
                disabled={loading || !currentPrompt}
              >
                Next sentence
              </Button>
            </Stack>

            {!speechSupported && (
              <Alert severity="info">Voice capture is not supported in this browser. You can still type your response and evaluate it.</Alert>
            )}

            <TextField
              label="Your spoken sentence (captured or typed)"
              multiline
              minRows={3}
              value={spokenText}
              onChange={(event) => setSpokenText(event.target.value)}
              disabled={loading}
            />

            {result && (
              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6">Feedback</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Chip color="primary" label={`Score ${result.score}/100`} />
                    <Chip label={`Coverage ${(Number(result.coverage_ratio || 0) * 100).toFixed(0)}%`} />
                    <Chip label={`Pace ${result.communication_metrics?.pacing_band || "n/a"}`} />
                  </Stack>
                  <Typography variant="body2"><strong>Improved sentence:</strong> {result.improved_sentence}</Typography>
                  <Typography variant="body2"><strong>Coaching:</strong></Typography>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {(result.coaching || []).map((item) => (
                      <li key={item}>
                        <Typography variant="body2">{item}</Typography>
                      </li>
                    ))}
                  </ul>
                  {(result.quality_flags || []).length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      {(result.quality_flags || []).map((flag) => (
                        <Chip key={flag} size="small" label={flag} variant="outlined" />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
