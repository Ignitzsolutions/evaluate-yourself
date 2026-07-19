import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWalletRounded,
  ArrowBackRounded,
  CreditCardRounded,
  Google,
  LockRounded,
  PaymentsRounded,
  PhoneIphoneRounded,
  QrCode2Rounded,
} from "@mui/icons-material";
import {
  findPricingPlan,
  paymentGatewayConfig,
  resolvePaymentUrl,
} from "../config/pricingConfig";

const methodIcons = {
  link: AccountBalanceWalletRounded,
  card: CreditCardRounded,
  upi: QrCode2Rounded,
  apple_pay: PhoneIphoneRounded,
  google_pay: Google,
};

const cardNetworks = ["Visa", "Mastercard", "RuPay", "Amex"];

function formatPaymentLabel(plan, method) {
  return `${method.label} checkout for ${plan.name}`;
}

export default function CheckoutPage() {
  const { planKey } = useParams();
  const navigate = useNavigate();
  const plan = useMemo(() => findPricingPlan(planKey), [planKey]);
  const [email, setEmail] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("card");
  const [configError, setConfigError] = useState("");

  const selectedPaymentMethod = paymentGatewayConfig.methods.find(
    (method) => method.key === selectedMethod,
  );
  const subtotal = plan.priceLabel;
  const paymentUrl = resolvePaymentUrl();

  const handleRedirect = () => {
    setConfigError("");
    if (!paymentUrl) {
      setConfigError(
        `Payment link is not configured for ${formatPaymentLabel(plan, selectedPaymentMethod)}.`,
      );
      return;
    }

    const url = new URL(paymentUrl, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) {
      setConfigError("Payment link must use an http or https URL.");
      return;
    }
    if (email.trim()) {
      url.searchParams.set("prefilled_email", email.trim());
    }
    url.searchParams.set("plan", plan.key);
    url.searchParams.set("method", selectedMethod);
    url.searchParams.set("amount", plan.priceLabel);
    url.searchParams.set("currency", paymentGatewayConfig.defaultCurrency);
    window.location.assign(url.toString());
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f8fafc", py: { xs: 4, md: 7 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate("/pricing")}
          sx={{ mb: 3, color: "text.secondary" }}
        >
          Back to pricing
        </Button>

        <Grid container spacing={{ xs: 4, md: 7 }} alignItems="flex-start">
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="body1" color="text.secondary">
                  Pay {paymentGatewayConfig.merchantName}
                </Typography>
                <Typography
                  variant="h2"
                  sx={{ mt: 0.5, fontWeight: 800, fontSize: { xs: "2.4rem", md: "3.2rem" } }}
                >
                  {plan.priceLabel}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {plan.priceSubLabel}
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: "#fff",
                  border: "1px solid rgba(148, 163, 184, 0.24)",
                  borderRadius: 2,
                  p: 2.5,
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1.5,
                    bgcolor: "#f0fdfa",
                      display: "grid",
                      placeItems: "center",
                    color: "#0f766e",
                    }}
                  >
                    <PaymentsRounded />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">{plan.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {plan.tagline}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {subtotal}
                  </Typography>
                </Stack>

                <Divider sx={{ my: 2.5 }} />
                <Stack spacing={1.3}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{subtotal}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Taxes</Typography>
                    <Typography color="text.secondary">Calculated by provider</Typography>
                  </Stack>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="h6">Total due</Typography>
                    <Typography variant="h6">{subtotal}</Typography>
                  </Stack>
                </Stack>
              </Box>

              <Alert severity="info" icon={<LockRounded />}>
                Payments redirect to your configured payment provider. This page does not store card,
                UPI, wallet, or bank details.
              </Alert>
            </Stack>
          </Grid>

          <Grid item xs={12} md={7}>
            <Box
              sx={{
                bgcolor: "#fff",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                borderRadius: 2,
                p: { xs: 2.5, md: 4 },
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)",
              }}
            >
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    Checkout
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Choose a payment route. Account linking can be added later after the payment
                    provider is finalized.
                  </Typography>
                </Box>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Contact information</Typography>
                  <TextField
                    type="email"
                    name="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    fullWidth
                    inputProps={{ "aria-label": "Email" }}
                  />
                </Stack>

                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Payment method</Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={selectedMethod}
                    onChange={(_, nextMethod) => nextMethod && setSelectedMethod(nextMethod)}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.25,
                      "& .MuiToggleButtonGroup-grouped": {
                        border: "1px solid rgba(148, 163, 184, 0.34)",
                        borderRadius: "12px !important",
                        m: 0,
                      },
                    }}
                  >
                    {paymentGatewayConfig.methods.map((method) => {
                      const Icon = methodIcons[method.key] || PaymentsRounded;
                      return (
                        <ToggleButton
                          key={method.key}
                          value={method.key}
                          aria-label={method.label}
                          sx={{
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            gap: 1.3,
                            p: 1.6,
                            textAlign: "left",
                            color: "text.primary",
                            "&.Mui-selected": {
                              bgcolor: "rgba(15, 118, 110, 0.08)",
                              borderColor: "rgba(15, 118, 110, 0.45)",
                            },
                          }}
                        >
                          <Icon sx={{ color: method.accent, mt: 0.2 }} />
                          <Box>
                            <Typography variant="subtitle2">{method.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {method.helper}
                            </Typography>
                          </Box>
                        </ToggleButton>
                      );
                    })}
                  </ToggleButtonGroup>
                </Stack>

                {selectedMethod === "card" && (
                  <Box
                    sx={{
                      border: "1px solid rgba(148, 163, 184, 0.28)",
                      borderRadius: 2,
                      p: 2,
                      bgcolor: "#f8fafc",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle2">Accepted card networks</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {cardNetworks.map((network) => (
                          <Chip key={network} label={network} variant="outlined" />
                        ))}
                      </Stack>
                    </Stack>
                  </Box>
                )}

                {configError && <Alert severity="warning">{configError}</Alert>}

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleRedirect}
                  sx={{
                    borderRadius: 2,
                    bgcolor: "#0f766e",
                    py: 1.35,
                    fontWeight: 800,
                    "&:hover": { bgcolor: "#115e59" },
                  }}
                >
                  Continue to {selectedPaymentMethod?.label || "payment"}
                </Button>

                <Typography variant="caption" color="text.secondary">
                  Provider redirects should be configured with Stripe Payment Links, Razorpay payment
                  links, UPI collect links, or another hosted checkout URL.
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
