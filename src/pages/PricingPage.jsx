import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import {
  BoltRounded,
  CheckCircleRounded,
  GroupsRounded,
  RemoveCircleOutlineRounded,
  ShieldOutlined,
  TrendingUpRounded,
  WorkspacePremiumRounded,
} from "@mui/icons-material";
import {
  pricingCapabilityCatalog,
  pricingPlans,
  trialConfig,
} from "../config/pricingConfig";
import WaitlistSignupForm from "../components/WaitlistSignupForm";

const proofPoints = [
  {
    icon: <BoltRounded fontSize="small" />,
    label: "Realtime Sonia practice",
  },
  {
    icon: <TrendingUpRounded fontSize="small" />,
    label: "Interview progress analytics",
  },
  {
    icon: <ShieldOutlined fontSize="small" />,
    label: "Evidence-backed reports",
  },
  {
    icon: <GroupsRounded fontSize="small" />,
    label: "Team-ready upgrades",
  },
];

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        py: { xs: 6, md: 10 },
        background:
          "radial-gradient(900px 360px at 10% 0%, rgba(15,118,110,0.14), transparent 60%), radial-gradient(700px 300px at 90% 10%, rgba(15,23,42,0.08), transparent 60%), #f7f6f3",
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        <Stack spacing={3.5} sx={{ mb: { xs: 4, md: 6 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ xs: "flex-start", md: "flex-end" }}
            justifyContent="space-between"
          >
            <Stack spacing={2} sx={{ maxWidth: 760 }}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  icon={<WorkspacePremiumRounded />}
                  label="Launch pricing"
                  sx={{
                    alignSelf: "flex-start",
                    bgcolor: "#0f172a",
                    color: "common.white",
                    fontWeight: 800,
                    "& .MuiChip-icon": { color: "common.white" },
                  }}
                />
                <Chip
                  label={trialConfig.label}
                  sx={{
                    alignSelf: "flex-start",
                    bgcolor: "rgba(15,118,110,0.1)",
                    color: "#0f766e",
                    fontWeight: 800,
                  }}
                />
              </Stack>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: "-0.045em",
                  lineHeight: 0.96,
                  fontSize: { xs: "2.35rem", md: "4rem" },
                  color: "#0f172a",
                }}
              >
                Choose the interview plan that matches your next career move.
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ maxWidth: 720, lineHeight: 1.65, fontWeight: 500 }}
              >
                {trialConfig.description} Upgrade when you need deeper scoring, role-specific practice, and team
                visibility.
              </Typography>
            </Stack>
            <Card
              sx={{
                width: { xs: "100%", md: 330 },
                borderRadius: 3,
                border: "1px solid rgba(15,23,42,0.1)",
                boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
                bgcolor: "rgba(255,255,255,0.92)",
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800 }}>
                  Included in every plan
                </Typography>
                <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                  {proofPoints.map((item) => (
                    <Stack key={item.label} direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "rgba(15,118,110,0.1)",
                          color: "#0f766e",
                        }}
                      >
                        {item.icon}
                      </Box>
                      <Typography variant="body2" sx={{ color: "#334155", fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <WaitlistSignupForm
            sourcePage="pricing"
            intent="free_trial"
            compact
            title="Join the free-trial waitlist"
            helperText="Leave your email to get notified when new 5-minute trial slots open."
          />
        </Stack>

        <Grid container spacing={2.5} alignItems="stretch" sx={{ mb: 4 }}>
          {pricingPlans.map((plan) => (
            <Grid item xs={12} md={4} key={plan.key}>
              <Card
                sx={{
                  position: "relative",
                  height: "100%",
                  overflow: "visible",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: plan.highlighted ? plan.accentColor : "rgba(15,23,42,0.1)",
                  boxShadow: plan.highlighted
                    ? "0 24px 70px rgba(15,118,110,0.18)"
                    : "0 12px 36px rgba(15,23,42,0.07)",
                  bgcolor: "#ffffff",
                  transform: { md: plan.highlighted ? "translateY(-10px)" : "none" },
                }}
              >
                {plan.badgeLabel ? (
                  <Chip
                    label={plan.badgeLabel}
                    sx={{
                      position: "absolute",
                      top: -18,
                      left: "50%",
                      transform: "translateX(-50%)",
                      bgcolor: plan.accentColor,
                      color: "common.white",
                      fontWeight: 900,
                      px: 1.2,
                      boxShadow: "0 10px 22px rgba(15,118,110,0.28)",
                    }}
                  />
                ) : null}

                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Stack spacing={2.2}>
                    <Stack spacing={1.2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography
                          variant="overline"
                          sx={{
                            color: plan.accentColor,
                            fontWeight: 900,
                            letterSpacing: "0.1em",
                          }}
                        >
                          {plan.tierLabel}
                        </Typography>
                        <Chip
                          label={plan.summaryMetric}
                          size="small"
                          sx={{
                            bgcolor: "rgba(15,23,42,0.05)",
                            color: "#334155",
                            fontWeight: 800,
                          }}
                        />
                      </Stack>
                      <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body1" sx={{ color: "text.secondary", minHeight: 48, lineHeight: 1.55 }}>
                        {plan.tagline}
                      </Typography>
                    </Stack>

                    <Box sx={{ pt: 1 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 900, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "2.7rem" } }}
                      >
                        {plan.priceLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {plan.priceSubLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        Best for: {plan.bestFor}
                      </Typography>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => navigate(`/checkout/${plan.key}`)}
                      sx={{
                        textTransform: "none",
                        borderRadius: 2.5,
                        py: 1.35,
                        fontWeight: 900,
                        bgcolor: plan.highlighted ? plan.accentColor : "#0b0f19",
                        boxShadow: plan.highlighted ? "0 14px 28px rgba(15,118,110,0.25)" : "none",
                        "&:hover": { bgcolor: plan.highlighted ? "#115e59" : "#111827" },
                      }}
                    >
                      {plan.ctaLabel}
                    </Button>

                    <Divider />

                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {plan.introLine}
                    </Typography>

                    <List dense sx={{ pt: 0, pb: 0 }}>
                      {pricingCapabilityCatalog.map((capability) => {
                        const access = plan.capabilityAccess[capability.key];
                        const included = Boolean(access?.included);
                        return (
                          <ListItem
                            key={capability.key}
                            disableGutters
                            sx={{
                              alignItems: "flex-start",
                              py: 0.75,
                              gap: 1,
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 28, mt: 0.1 }}>
                              {included ? (
                                <CheckCircleRounded
                                  fontSize="small"
                                  sx={{ color: plan.accentColor }}
                                  aria-label={`${capability.label} included`}
                                />
                              ) : (
                                <RemoveCircleOutlineRounded
                                  fontSize="small"
                                  sx={{ color: "#94a3b8" }}
                                  aria-label={`${capability.label} not included`}
                                />
                              )}
                          </ListItemIcon>
                          <ListItemText
                              primary={capability.label}
                              secondary={access?.value}
                              primaryTypographyProps={{
                                variant: "body2",
                                sx: {
                                  color: included ? "text.primary" : "#64748b",
                                  fontWeight: 800,
                                },
                              }}
                              secondaryTypographyProps={{
                                variant: "caption",
                                sx: {
                                  color: included ? "#475569" : "#94a3b8",
                                  fontWeight: 700,
                                },
                              }}
                          />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid rgba(15,23,42,0.1)",
            bgcolor: "rgba(255,255,255,0.78)",
            boxShadow: "0 12px 42px rgba(15,23,42,0.06)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Not sure which plan fits?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Start with Launchpad, then upgrade when you need unlimited practice or team-level analytics.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={() => navigate("/checkout/pro")}
                sx={{
                  textTransform: "none",
                  borderRadius: 2,
                  fontWeight: 900,
                  px: 2.5,
                  borderColor: "#0f766e",
                  color: "#0f766e",
                  "&:hover": {
                    borderColor: "#115e59",
                    bgcolor: "rgba(15,118,110,0.06)",
                  },
                }}
              >
                Compare from Career Sprint
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
