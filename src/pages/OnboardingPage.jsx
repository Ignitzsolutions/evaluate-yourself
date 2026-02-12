import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "";

const steps = ["Profile Type", "Goals", "Background", "Consent"];

const commonOptions = {
  primaryGoal: ["Mock interviews", "Placement prep", "Job switch", "Leadership prep", "Consulting readiness"],
  industries: ["Software", "Finance", "Consulting", "Product", "Healthcare", "Operations", "Sales"],
  interviewTimeline: ["Within 2 weeks", "Within 1 month", "1-3 months", "3+ months"],
  prepIntensity: ["Light", "Moderate", "Intense"],
  learningStyle: ["Rapid drills", "Detailed review", "Balanced"],
  targetRoles: ["SDE", "Data", "Product", "Analyst", "Consultant", "Design", "Management"],
};

const studentOptions = {
  educationLevel: ["Undergraduate", "Postgraduate", "Bootcamp", "Other"],
  graduationTimeline: ["Current semester", "Within 6 months", "Within 12 months", "Already graduated"],
  majorDomain: ["Computer Science", "Electronics", "Business", "Design", "Other"],
  placementReadiness: ["Just starting", "Practicing regularly", "Interview ready"],
};

const professionalOptions = {
  experienceBand: ["0-2 years", "3-5 years", "6-9 years", "10+ years"],
  managementScope: ["Individual contributor", "Mentoring", "Team lead", "Org lead"],
  targetCompanyType: ["Startup", "Mid-size", "Enterprise", "Global MNC"],
  careerTransitionIntent: ["Same role growth", "Role switch", "Industry switch", "Leadership track"],
  noticePeriodBand: ["Immediate", "Within 30 days", "31-60 days", "60+ days"],
  careerCompBand: ["Foundation", "Growth", "Advanced", "Leadership"],
  interviewUrgency: ["Actively interviewing", "Preparing now", "Exploring opportunities"],
  domainExpertise: ["Backend", "Frontend", "Data", "Cloud", "Product", "Sales", "Operations", "HR"],
};

const initialForm = {
  userCategory: "",
  primaryGoal: "",
  targetRoles: [],
  industries: [],
  interviewTimeline: "",
  prepIntensity: "",
  learningStyle: "",
  consentDataUse: false,
  educationLevel: "",
  graduationTimeline: "",
  majorDomain: "",
  placementReadiness: "",
  currentRole: "",
  experienceBand: "",
  managementScope: "",
  domainExpertise: [],
  targetCompanyType: "",
  careerTransitionIntent: "",
  noticePeriodBand: "",
  careerCompBand: "",
  interviewUrgency: "",
};

function SelectChips({ title, options, value, onChange }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            clickable
            color={value === option ? "primary" : "default"}
            variant={value === option ? "filled" : "outlined"}
            onClick={() => onChange(option)}
            sx={{ borderRadius: "10px" }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function MultiSelectChips({ title, options, value, onChange }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <Chip
              key={option}
              label={option}
              clickable
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              onClick={() => onChange(option)}
              sx={{ borderRadius: "10px" }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const token = await getToken();
        const resp = await authFetch(`${API_BASE_URL}/api/profile/me`, token, { method: "GET" });
        if (!mounted) return;
        if (resp.status === 404) {
          setLoading(false);
          return;
        }
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || "Failed to load profile");
        }
        const profile = await resp.json();
        setForm((prev) => ({
          ...prev,
          userCategory: profile.userCategory || "",
          primaryGoal: profile.primaryGoal || "",
          targetRoles: Array.isArray(profile.targetRoles) ? profile.targetRoles : [],
          industries: Array.isArray(profile.industries) ? profile.industries : [],
          interviewTimeline: profile.interviewTimeline || "",
          prepIntensity: profile.prepIntensity || "",
          learningStyle: profile.learningStyle || "",
          consentDataUse: Boolean(profile.consentDataUse),
          educationLevel: profile.educationLevel || "",
          graduationTimeline: profile.graduationTimeline || "",
          majorDomain: profile.majorDomain || "",
          placementReadiness: profile.placementReadiness || "",
          currentRole: profile.currentRole || "",
          experienceBand: profile.experienceBand || "",
          managementScope: profile.managementScope || "",
          domainExpertise: Array.isArray(profile.domainExpertise) ? profile.domainExpertise : [],
          targetCompanyType: profile.targetCompanyType || "",
          careerTransitionIntent: profile.careerTransitionIntent || "",
          noticePeriodBand: profile.noticePeriodBand || "",
          careerCompBand: profile.careerCompBand || "",
          interviewUrgency: profile.interviewUrgency || "",
        }));
      } catch (loadErr) {
        setError(loadErr.message || "Failed to load profile.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const categoryLabel = useMemo(() => {
    if (form.userCategory === "student") return "Student";
    if (form.userCategory === "professional") return "Working Professional";
    return "Not selected";
  }, [form.userCategory]);

  const toggleMulti = (field, option) => {
    setForm((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option],
      };
    });
  };

  const validateStep = (step) => {
    if (step === 0) {
      return Boolean(form.userCategory);
    }
    if (step === 1) {
      return Boolean(
        form.primaryGoal &&
          form.targetRoles.length > 0 &&
          form.industries.length > 0 &&
          form.interviewTimeline &&
          form.prepIntensity &&
          form.learningStyle
      );
    }
    if (step === 2) {
      if (form.userCategory === "student") {
        return Boolean(
          form.educationLevel &&
            form.graduationTimeline &&
            form.majorDomain &&
            form.placementReadiness
        );
      }
      if (form.userCategory === "professional") {
        return Boolean(
          form.currentRole &&
            form.experienceBand &&
            form.managementScope &&
            form.domainExpertise.length > 0 &&
            form.targetCompanyType &&
            form.careerTransitionIntent &&
            form.noticePeriodBand &&
            form.careerCompBand &&
            form.interviewUrgency
        );
      }
      return false;
    }
    if (step === 3) {
      return Boolean(form.consentDataUse);
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(activeStep)) {
      setError("Please complete all required selections for this step.");
      return;
    }
    setError("");
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError("");
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setError("Consent is required to continue.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const payload = {
        userCategory: form.userCategory,
        primaryGoal: form.primaryGoal,
        targetRoles: form.targetRoles,
        industries: form.industries,
        interviewTimeline: form.interviewTimeline,
        prepIntensity: form.prepIntensity,
        learningStyle: form.learningStyle,
        consentDataUse: form.consentDataUse,
        educationLevel: form.educationLevel || null,
        graduationTimeline: form.graduationTimeline || null,
        majorDomain: form.majorDomain || null,
        placementReadiness: form.placementReadiness || null,
        currentRole: form.currentRole || null,
        experienceBand: form.experienceBand || null,
        managementScope: form.managementScope || null,
        domainExpertise: form.domainExpertise,
        targetCompanyType: form.targetCompanyType || null,
        careerTransitionIntent: form.careerTransitionIntent || null,
        noticePeriodBand: form.noticePeriodBand || null,
        careerCompBand: form.careerCompBand || null,
        interviewUrgency: form.interviewUrgency || null,
      };
      const resp = await authFetch(`${API_BASE_URL}/api/profile/me`, token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to save onboarding profile.");
      }
      navigate("/dashboard");
    } catch (submitErr) {
      setError(submitErr.message || "Failed to save onboarding profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(900px 360px at 0% 0%, rgba(37,99,235,0.14), transparent 60%), radial-gradient(800px 320px at 100% 0%, rgba(14,116,144,0.12), transparent 60%), #f8fafc",
      }}
    >
      <Container maxWidth="lg">
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 16px 50px rgba(15,23,42,0.1)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  Build Your Interview Intelligence Profile
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  This powers personalized interview simulations, analytics, and consulting insights.
                </Typography>
              </Box>

              <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {error && <Alert severity="error">{error}</Alert>}

              {activeStep === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card
                      onClick={() => setForm((prev) => ({ ...prev, userCategory: "student" }))}
                      sx={{
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: form.userCategory === "student" ? "primary.main" : "divider",
                        bgcolor: form.userCategory === "student" ? "rgba(37,99,235,0.06)" : "background.paper",
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Student Track
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Campus placements, internships, and first-job interview prep.
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card
                      onClick={() => setForm((prev) => ({ ...prev, userCategory: "professional" }))}
                      sx={{
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: form.userCategory === "professional" ? "primary.main" : "divider",
                        bgcolor: form.userCategory === "professional" ? "rgba(37,99,235,0.06)" : "background.paper",
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          Working Professional Track
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Growth, transitions, and high-stakes interview coaching.
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {activeStep === 1 && (
                <Stack spacing={2.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Profile Type: {categoryLabel}
                  </Typography>
                  <SelectChips
                    title="Primary interview goal"
                    options={commonOptions.primaryGoal}
                    value={form.primaryGoal}
                    onChange={(option) => setForm((prev) => ({ ...prev, primaryGoal: option }))}
                  />
                  <MultiSelectChips
                    title="Target roles"
                    options={commonOptions.targetRoles}
                    value={form.targetRoles}
                    onChange={(option) => toggleMulti("targetRoles", option)}
                  />
                  <MultiSelectChips
                    title="Preferred industries"
                    options={commonOptions.industries}
                    value={form.industries}
                    onChange={(option) => toggleMulti("industries", option)}
                  />
                  <SelectChips
                    title="Interview timeline"
                    options={commonOptions.interviewTimeline}
                    value={form.interviewTimeline}
                    onChange={(option) => setForm((prev) => ({ ...prev, interviewTimeline: option }))}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Preparation intensity"
                        options={commonOptions.prepIntensity}
                        value={form.prepIntensity}
                        onChange={(option) => setForm((prev) => ({ ...prev, prepIntensity: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Learning style"
                        options={commonOptions.learningStyle}
                        value={form.learningStyle}
                        onChange={(option) => setForm((prev) => ({ ...prev, learningStyle: option }))}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              )}

              {activeStep === 2 && form.userCategory === "student" && (
                <Stack spacing={2.5}>
                  <SelectChips
                    title="Education level"
                    options={studentOptions.educationLevel}
                    value={form.educationLevel}
                    onChange={(option) => setForm((prev) => ({ ...prev, educationLevel: option }))}
                  />
                  <SelectChips
                    title="Graduation timeline"
                    options={studentOptions.graduationTimeline}
                    value={form.graduationTimeline}
                    onChange={(option) => setForm((prev) => ({ ...prev, graduationTimeline: option }))}
                  />
                  <SelectChips
                    title="Major / domain"
                    options={studentOptions.majorDomain}
                    value={form.majorDomain}
                    onChange={(option) => setForm((prev) => ({ ...prev, majorDomain: option }))}
                  />
                  <SelectChips
                    title="Placement readiness"
                    options={studentOptions.placementReadiness}
                    value={form.placementReadiness}
                    onChange={(option) => setForm((prev) => ({ ...prev, placementReadiness: option }))}
                  />
                </Stack>
              )}

              {activeStep === 2 && form.userCategory === "professional" && (
                <Stack spacing={2.5}>
                  <SelectChips
                    title="Current role"
                    options={["Engineer", "Analyst", "Manager", "Consultant", "Product", "Sales", "Operations"]}
                    value={form.currentRole}
                    onChange={(option) => setForm((prev) => ({ ...prev, currentRole: option }))}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Experience band"
                        options={professionalOptions.experienceBand}
                        value={form.experienceBand}
                        onChange={(option) => setForm((prev) => ({ ...prev, experienceBand: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Management scope"
                        options={professionalOptions.managementScope}
                        value={form.managementScope}
                        onChange={(option) => setForm((prev) => ({ ...prev, managementScope: option }))}
                      />
                    </Grid>
                  </Grid>
                  <MultiSelectChips
                    title="Domain expertise"
                    options={professionalOptions.domainExpertise}
                    value={form.domainExpertise}
                    onChange={(option) => toggleMulti("domainExpertise", option)}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Target company type"
                        options={professionalOptions.targetCompanyType}
                        value={form.targetCompanyType}
                        onChange={(option) => setForm((prev) => ({ ...prev, targetCompanyType: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Transition intent"
                        options={professionalOptions.careerTransitionIntent}
                        value={form.careerTransitionIntent}
                        onChange={(option) => setForm((prev) => ({ ...prev, careerTransitionIntent: option }))}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <SelectChips
                        title="Notice period band"
                        options={professionalOptions.noticePeriodBand}
                        value={form.noticePeriodBand}
                        onChange={(option) => setForm((prev) => ({ ...prev, noticePeriodBand: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <SelectChips
                        title="Career compensation band"
                        options={professionalOptions.careerCompBand}
                        value={form.careerCompBand}
                        onChange={(option) => setForm((prev) => ({ ...prev, careerCompBand: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <SelectChips
                        title="Interview urgency"
                        options={professionalOptions.interviewUrgency}
                        value={form.interviewUrgency}
                        onChange={(option) => setForm((prev) => ({ ...prev, interviewUrgency: option }))}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              )}

              {activeStep === 3 && (
                <Stack spacing={2}>
                  <Alert severity="info">
                    We will use this profile and interview performance data to personalize coaching and
                    consulting-grade analytics.
                  </Alert>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.consentDataUse}
                        onChange={(e) => setForm((prev) => ({ ...prev, consentDataUse: e.target.checked }))}
                      />
                    }
                    label="I explicitly consent to profile and interview data usage for analytics, consulting insights, and service improvement."
                  />
                </Stack>
              )}

              <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                <Button disabled={activeStep === 0 || saving} onClick={handleBack}>
                  Back
                </Button>
                {activeStep < steps.length - 1 ? (
                  <Button variant="contained" onClick={handleNext} disabled={saving}>
                    Next
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : "Complete Setup"}
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
