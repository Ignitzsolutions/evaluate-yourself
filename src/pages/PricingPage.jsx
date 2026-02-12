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
import { CheckRounded } from "@mui/icons-material";
import { pricingPlans, trialConfig } from "../config/pricingConfig";

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 6, md: 10 },
        background:
          "radial-gradient(900px 360px at 10% 0%, rgba(37,99,235,0.16), transparent 60%), radial-gradient(700px 300px at 90% 10%, rgba(15,23,42,0.08), transparent 60%), #f8fafc",
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ mb: 5 }}>
          <Chip
            label={trialConfig.label}
            color="primary"
            sx={{ alignSelf: "flex-start", fontWeight: 700 }}
          />
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            Pricing That Scales With Interview Goals
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 780 }}>
            {trialConfig.description} Upgrade when you need deeper analytics and role-specific preparation.
          </Typography>
        </Stack>

        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {pricingPlans.map((plan) => (
            <Grid item xs={12} md={4} key={plan.key}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.1}>
                    <Typography variant="overline" color="text.secondary">
                      {plan.tierLabel}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "text.secondary", minHeight: 28 }}>
                      {plan.tagline}
                    </Typography>

                    <Box sx={{ pt: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {plan.priceLabel}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {plan.priceSubLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        Best for: {plan.bestFor}
                      </Typography>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => navigate("/register")}
                      sx={{
                        mt: 2,
                        textTransform: "none",
                        borderRadius: 2,
                        py: 1.15,
                        fontWeight: 700,
                        bgcolor: "#0b0f19",
                        "&:hover": { bgcolor: "#111827" },
                      }}
                    >
                      {plan.ctaLabel}
                    </Button>

                    <Divider sx={{ my: 2.2 }} />

                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {plan.introLine}
                    </Typography>

                    <List dense sx={{ pt: 0 }}>
                      {plan.features.map((feature) => (
                        <ListItem key={feature} disableGutters sx={{ alignItems: "flex-start", py: 0.15 }}>
                          <ListItemIcon sx={{ minWidth: 30, mt: 0.2 }}>
                            <CheckRounded fontSize="small" sx={{ color: "#0f172a" }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature}
                            primaryTypographyProps={{ variant: "body1", sx: { color: "text.primary" } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
