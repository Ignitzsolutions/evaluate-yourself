import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
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
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";

const API_BASE_URL = getApiBaseUrl();

const steps = ["Fast Start", "Profile Details", "Consent"];

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
  seniorityLevel: ["Foundation", "Growth", "Advanced", "Leadership"],
  managementScope: ["Individual contributor", "Mentoring", "Team lead", "Org lead"],
  targetCompanyType: ["Startup", "Mid-size", "Enterprise", "Global MNC"],
  careerTransitionIntent: ["Same role growth", "Role switch", "Industry switch", "Leadership track"],
  noticePeriodBand: ["Immediate", "Within 30 days", "31-60 days", "60+ days"],
};

const countryOptions = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "SG", label: "Singapore" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "OTHER", label: "Other" },
];

const timezoneOptions = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Helsinki",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
];

const interviewFormats = ["Phone screen", "Technical", "System design", "Behavioral", "Case", "Take-home"];

const skillOptions = [
  { key: "python_fundamentals", label: "Python fundamentals" },
  { key: "java_full_stack", label: "Java full stack" },
  { key: "machine_learning_python", label: "Machine learning with Python" },
  { key: "genai_python_cloud", label: "GenAI, Python, and cloud" },
  { key: "frontend_engineering", label: "Frontend engineering" },
  { key: "data_analytics_sql_python", label: "Data analytics with SQL and Python" },
  { key: "devops_cloud_basics", label: "DevOps and cloud basics" },
  { key: "testing_qa_automation", label: "Testing and QA automation" },
  { key: "cybersecurity_basics", label: "Cybersecurity basics" },
  { key: "product_analyst_basics", label: "Product analyst basics" },
];

const initialForm = {
  userCategory: "professional",
  primaryGoal: "",
  targetRoles: [],
  industries: [],
  interviewTimeline: "",
  prepIntensity: "Moderate",
  learningStyle: "Balanced",
  consentDataUse: false,
  consentContact: false,
  stateCode: "",
  city: "",
  countryCode: "IN",
  timezone: "Asia/Kolkata",
  universityName: "",
  degreeName: "",
  graduationYear: "",
  primaryStream: "",
  skillRatings: {},
  educationLevel: "",
  graduationTimeline: "",
  majorDomain: "",
  placementReadiness: "",
  currentRole: "",
  yearsOfExperience: "",
  seniorityLevel: "",
  managementScope: "",
  targetCompanyType: "",
  careerTransitionIntent: "",
  noticePeriodBand: "",
  interviewFormat: "",
};

const extrasStorageKey = "onboardingProfileExtras";

function readExtras() {
  try {
    return JSON.parse(localStorage.getItem(extrasStorageKey) || "{}");
  } catch (_err) {
    return {};
  }
}

function writeExtras(form) {
  localStorage.setItem(
    extrasStorageKey,
    JSON.stringify({
      timezone: form.timezone,
      yearsOfExperience: form.yearsOfExperience,
      seniorityLevel: form.seniorityLevel,
      interviewFormat: form.interviewFormat,
      skillRatings: form.skillRatings,
    }),
  );
}

function SelectChips({ title, options, value, onChange, helperText }) {
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
      {helperText && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
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

function ProfileTypeButton({ selected, title, description, onClick }) {
  return (
    <Button
      fullWidth
      variant={selected ? "contained" : "outlined"}
      onClick={onClick}
      sx={{
        alignItems: "flex-start",
        borderRadius: 2,
        justifyContent: "flex-start",
        minHeight: 112,
        p: 2,
        textAlign: "left",
        textTransform: "none",
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: selected ? "primary.contrastText" : "text.secondary" }}>
          {description}
        </Typography>
      </Stack>
    </Button>
  );
}

function SkillRatingGrid({ ratings, onChange }) {
  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Skill self-ratings
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Rate skills from 1 to 5. The strongest rated skill becomes the primary stream for interview calibration.
        </Typography>
      </Box>
      <Grid container spacing={1.5}>
        {skillOptions.map((skill) => (
          <Grid item xs={12} sm={6} md={4} key={skill.key}>
            <Box
              sx={{
                border: "1px solid",
                borderColor: ratings[skill.key] ? "primary.main" : "divider",
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Typography id={`${skill.key}-label`} variant="body2" sx={{ fontWeight: 700 }}>
                {skill.label}
              </Typography>
              <Rating
                aria-labelledby={`${skill.key}-label`}
                name={`rating-${skill.key}`}
                value={ratings[skill.key] || 0}
                onChange={(_event, nextValue) => onChange(skill.key, nextValue || 0)}
                max={5}
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({ ...initialForm, ...readExtras() }));

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
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
        const extras = readExtras();
        const parsedYears = parseInt(profile.experienceBand, 10);
        setForm((prev) => ({
          ...prev,
          ...extras,
          userCategory: profile.userCategory || "professional",
          primaryGoal: profile.primaryGoal || "",
          targetRoles: Array.isArray(profile.targetRoles) ? profile.targetRoles : [],
          industries: Array.isArray(profile.industries) ? profile.industries : [],
          interviewTimeline: profile.interviewTimeline || "",
          prepIntensity: profile.prepIntensity || "Moderate",
          learningStyle: profile.learningStyle || "Balanced",
          consentDataUse: Boolean(profile.consentDataUse),
          consentContact: Boolean(profile.consentContact),
          stateCode: profile.stateCode || "",
          city: profile.city || "",
          countryCode: profile.countryCode || "IN",
          timezone: profile.timezone || extras.timezone || "Asia/Kolkata",
          universityName: profile.universityName || "",
          degreeName: profile.degreeName || "",
          graduationYear: profile.graduationYear ? String(profile.graduationYear) : "",
          primaryStream: profile.primaryStream || "",
          educationLevel: profile.educationLevel || "",
          graduationTimeline: profile.graduationTimeline || "",
          majorDomain: profile.majorDomain || "",
          placementReadiness: profile.placementReadiness || "",
          currentRole: profile.currentRole || "",
          managementScope: profile.managementScope || "",
          targetCompanyType: profile.targetCompanyType || "",
          careerTransitionIntent: profile.careerTransitionIntent || "",
          noticePeriodBand: profile.noticePeriodBand || "",
          seniorityLevel: profile.seniority || profile.careerCompBand || extras.seniorityLevel || "",
          yearsOfExperience: profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : (extras.yearsOfExperience || (Number.isFinite(parsedYears) ? String(parsedYears) : "")),
          interviewFormat: profile.targetInterviewFormat || extras.interviewFormat || "",
          skillRatings: Array.isArray(profile.skillsSelfReported)
            ? profile.skillsSelfReported.reduce((acc, item) => {
                if (item && typeof item === "object" && item.key && item.rating) acc[item.key] = item.rating;
                return acc;
              }, extras.skillRatings || {})
            : extras.skillRatings || {},
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
  }, [isLoaded, isSignedIn, getToken]);

  const selectedSkills = useMemo(
    () =>
      Object.entries(form.skillRatings || {})
        .filter(([, rating]) => rating > 0)
        .sort((a, b) => b[1] - a[1]),
    [form.skillRatings],
  );

  const categoryLabel = form.userCategory === "student" ? "Student" : "Working Professional";

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

  const setSkillRating = (skillKey, rating) => {
    setForm((prev) => {
      const nextRatings = { ...(prev.skillRatings || {}), [skillKey]: rating };
      if (!rating) {
        delete nextRatings[skillKey];
      }
      const topSkill = Object.entries(nextRatings).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return {
        ...prev,
        skillRatings: nextRatings,
        primaryStream: topSkill,
      };
    });
  };

  const validateStep = (step) => {
    if (step === 0) {
      return Boolean(
        form.primaryGoal &&
          form.targetRoles.length > 0 &&
          form.seniorityLevel &&
          form.interviewFormat
      );
    }
    if (step === 1) {
      return Boolean(form.countryCode && form.stateCode && form.timezone && form.primaryStream);
    }
    if (step === 2) {
      return Boolean(form.consentDataUse);
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(activeStep)) {
      setError("Please complete the required fields before continuing.");
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
    if (!validateStep(2)) {
      setError("Data-use consent is required to continue. Contact consent is optional.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const selectedSkillLabels = selectedSkills.map(([key, rating]) => {
        const skill = skillOptions.find((item) => item.key === key);
        return `${skill?.label || key} (${rating}/5)`;
      });
      const selectedSkillRatings = selectedSkills.map(([key, rating]) => {
        const skill = skillOptions.find((item) => item.key === key);
        return {
          key,
          label: skill?.label || key,
          rating,
        };
      });
      const payload = {
        userCategory: form.userCategory,
        primaryGoal: form.primaryGoal,
        targetRoles: form.targetRoles,
        industries: form.industries.length ? form.industries : ["Software"],
        interviewTimeline: form.interviewTimeline || "Within 1 month",
        prepIntensity: form.prepIntensity || "Moderate",
        learningStyle: form.learningStyle || "Balanced",
        consentDataUse: form.consentDataUse,
        consentContact: form.consentContact,
        stateCode: form.stateCode || null,
        region: form.stateCode || null,
        city: form.city || null,
        countryCode: form.countryCode || "IN",
        timezone: form.timezone || null,
        universityName: form.universityName || null,
        degreeName: form.degreeName || null,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        primaryStream: form.primaryStream || null,
        skillsSelfReported: selectedSkillRatings,
        seniority: form.seniorityLevel || null,
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        currentTitle: form.currentRole || null,
        targetInterviewFormat: form.interviewFormat || null,
        educationLevel: form.educationLevel || null,
        graduationTimeline: form.graduationTimeline || null,
        majorDomain: form.majorDomain || null,
        placementReadiness: form.placementReadiness || null,
        currentRole: form.currentRole || null,
        experienceBand: form.yearsOfExperience ? `${form.yearsOfExperience} years` : null,
        managementScope: form.managementScope || null,
        domainExpertise: selectedSkillLabels,
        targetCompanyType: form.targetCompanyType || null,
        careerTransitionIntent: form.careerTransitionIntent || null,
        noticePeriodBand: form.noticePeriodBand || null,
        careerCompBand: form.seniorityLevel || null,
        interviewUrgency: form.interviewTimeline || null,
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
      writeExtras(form);
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
    <Box sx={{ minHeight: "100vh", py: { xs: 3, md: 5 }, bgcolor: "#f8fafc" }}>
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
                  Start with the essentials now. You can enrich the profile as coaching data grows.
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
                <Stack spacing={2.5}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <ProfileTypeButton
                        selected={form.userCategory === "student"}
                        title="Student"
                        description="Campus placements, internships, and first-job interview prep."
                        onClick={() => setForm((prev) => ({ ...prev, userCategory: "student" }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <ProfileTypeButton
                        selected={form.userCategory === "professional"}
                        title="Working Professional"
                        description="Growth, transitions, and high-stakes interview coaching."
                        onClick={() => setForm((prev) => ({ ...prev, userCategory: "professional" }))}
                      />
                    </Grid>
                  </Grid>

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
                    title="Target role"
                    options={commonOptions.targetRoles}
                    value={form.targetRoles}
                    onChange={(option) => toggleMulti("targetRoles", option)}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Seniority"
                        options={professionalOptions.seniorityLevel}
                        value={form.seniorityLevel}
                        onChange={(option) => setForm((prev) => ({ ...prev, seniorityLevel: option }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SelectChips
                        title="Target interview format"
                        options={interviewFormats}
                        value={form.interviewFormat}
                        onChange={(option) => setForm((prev) => ({ ...prev, interviewFormat: option }))}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              )}

              {activeStep === 1 && (
                <Stack spacing={2.5}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth required>
                        <InputLabel id="country-label">Country</InputLabel>
                        <Select
                          labelId="country-label"
                          label="Country"
                          value={form.countryCode}
                          onChange={(e) => setForm((prev) => ({ ...prev, countryCode: e.target.value }))}
                        >
                          {countryOptions.map((country) => (
                            <MenuItem key={country.code} value={country.code}>
                              {country.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        required
                        label="Region / State"
                        value={form.stateCode}
                        onChange={(e) => setForm((prev) => ({ ...prev, stateCode: e.target.value }))}
                        helperText="Use a state, province, emirate, or region name."
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth required>
                        <InputLabel id="timezone-label">Timezone</InputLabel>
                        <Select
                          labelId="timezone-label"
                          label="Timezone"
                          value={form.timezone}
                          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                        >
                          {timezoneOptions.map((timezone) => (
                            <MenuItem key={timezone} value={timezone}>
                              {timezone}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>Used for reminders and interview scheduling context.</FormHelperText>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <SkillRatingGrid ratings={form.skillRatings} onChange={setSkillRating} />

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Current title"
                        value={form.currentRole}
                        onChange={(e) => setForm((prev) => ({ ...prev, currentRole: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Years of experience"
                        inputProps={{ min: 0, max: 60, step: 1 }}
                        value={form.yearsOfExperience}
                        onChange={(e) => setForm((prev) => ({ ...prev, yearsOfExperience: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="City"
                        value={form.city}
                        onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="University / College"
                        value={form.universityName}
                        onChange={(e) => setForm((prev) => ({ ...prev, universityName: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Degree Name"
                        value={form.degreeName}
                        onChange={(e) => setForm((prev) => ({ ...prev, degreeName: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Graduation Year"
                        value={form.graduationYear}
                        onChange={(e) => setForm((prev) => ({ ...prev, graduationYear: e.target.value }))}
                      />
                    </Grid>
                  </Grid>

                  {form.userCategory === "student" ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <SelectChips
                          title="Education level"
                          options={studentOptions.educationLevel}
                          value={form.educationLevel}
                          onChange={(option) => setForm((prev) => ({ ...prev, educationLevel: option }))}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <SelectChips
                          title="Placement readiness"
                          options={studentOptions.placementReadiness}
                          value={form.placementReadiness}
                          onChange={(option) => setForm((prev) => ({ ...prev, placementReadiness: option }))}
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <SelectChips
                          title="Management scope"
                          options={professionalOptions.managementScope}
                          value={form.managementScope}
                          onChange={(option) => setForm((prev) => ({ ...prev, managementScope: option }))}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <SelectChips
                          title="Target company type"
                          options={professionalOptions.targetCompanyType}
                          value={form.targetCompanyType}
                          onChange={(option) => setForm((prev) => ({ ...prev, targetCompanyType: option }))}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <SelectChips
                          title="Transition intent"
                          options={professionalOptions.careerTransitionIntent}
                          value={form.careerTransitionIntent}
                          onChange={(option) => setForm((prev) => ({ ...prev, careerTransitionIntent: option }))}
                        />
                      </Grid>
                    </Grid>
                  )}

                  <MultiSelectChips
                    title="Preferred industries"
                    options={commonOptions.industries}
                    value={form.industries}
                    onChange={(option) => toggleMulti("industries", option)}
                  />
                </Stack>
              )}

              {activeStep === 2 && (
                <Stack spacing={2}>
                  <Alert severity="info">
                    Data-use consent is required for personalized coaching. Contact consent is optional.
                  </Alert>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.consentDataUse}
                        onChange={(e) => setForm((prev) => ({ ...prev, consentDataUse: e.target.checked }))}
                      />
                    }
                    label="I consent to profile and interview data usage for personalized coaching, analytics, and service improvement."
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.consentContact}
                        onChange={(e) => setForm((prev) => ({ ...prev, consentContact: e.target.checked }))}
                      />
                    }
                    label="Optional: I agree to be contacted for interview support, updates, and follow-up guidance."
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
