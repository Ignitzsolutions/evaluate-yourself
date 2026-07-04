export const trialConfig = {
  label: "Try Free for 5 Minutes",
  description: "Start one realtime interview session with full AI interviewer experience.",
};

export const pricingCapabilityCatalog = [
  {
    key: "aiInterviews",
    label: "AI interview sessions",
  },
  {
    key: "roleTracks",
    label: "Role-specific tracks",
  },
  {
    key: "analytics",
    label: "Performance analytics",
  },
  {
    key: "evaluationDepth",
    label: "Technical depth analysis",
  },
  {
    key: "exports",
    label: "Transcript and report export",
  },
  {
    key: "teamTools",
    label: "Team and cohort workspace",
  },
  {
    key: "support",
    label: "Implementation support",
  },
];

export const pricingPlans = [
  {
    key: "basic",
    name: "Launchpad",
    tierLabel: "Basic",
    tagline: "For students and early job seekers",
    priceLabel: "₹499",
    priceSubLabel: "Per month",
    bestFor: "Students & early job seekers",
    ctaLabel: "Start Launchpad",
    accentColor: "#2563eb",
    summaryMetric: "3 practice tracks",
    introLine: "Everything you need to start practicing consistently:",
    features: [
      "Core platform access",
      "Limited AI interviews",
      "Basic performance scores",
      "Transcript and report export",
      "Guided interview templates",
    ],
    capabilityAccess: {
      aiInterviews: { included: true, value: "Limited monthly sessions" },
      roleTracks: { included: true, value: "Guided starter templates" },
      analytics: { included: true, value: "Basic scores" },
      evaluationDepth: { included: false, value: "Advanced reasoning review" },
      exports: { included: true, value: "PDF and transcript" },
      teamTools: { included: false, value: "Cohort dashboard" },
      support: { included: false, value: "Priority implementation" },
    },
  },
  {
    key: "pro",
    name: "Career Sprint",
    tierLabel: "Pro",
    badgeLabel: "Most popular",
    highlighted: true,
    tagline: "For serious interview preparation",
    priceLabel: "₹1,499",
    priceSubLabel: "Per month",
    bestFor: "Serious interview prep",
    ctaLabel: "Start Career Sprint",
    accentColor: "#0f766e",
    summaryMetric: "Unlimited practice",
    introLine: "Everything in Launchpad, plus:",
    features: [
      "Unlimited AI interviews",
      "Advanced performance scores",
      "Role-specific interview tracks",
      "Analytics over time",
      "Stronger depth and reasoning analysis",
    ],
    capabilityAccess: {
      aiInterviews: { included: true, value: "Unlimited sessions" },
      roleTracks: { included: true, value: "Role and skill tracks" },
      analytics: { included: true, value: "Trend analytics" },
      evaluationDepth: { included: true, value: "Depth and reasoning review" },
      exports: { included: true, value: "PDF and transcript" },
      teamTools: { included: false, value: "Cohort dashboard" },
      support: { included: false, value: "Priority implementation" },
    },
  },
  {
    key: "enterprise",
    name: "Talent Grid",
    tierLabel: "Enterprise",
    tagline: "For institutions and hiring teams",
    priceLabel: "₹7,999",
    priceSubLabel: "Per month",
    bestFor: "Institutions & teams",
    ctaLabel: "Contact Sales",
    accentColor: "#7c3aed",
    summaryMetric: "Team rollout",
    introLine: "Everything in Career Sprint, plus:",
    features: [
      "Team and cohort analytics",
      "Role-specific interviews at scale",
      "Advanced trend reporting",
      "Centralized progress management",
      "Priority implementation support",
    ],
    capabilityAccess: {
      aiInterviews: { included: true, value: "Scaled interview volume" },
      roleTracks: { included: true, value: "Custom role tracks" },
      analytics: { included: true, value: "Cohort trend reporting" },
      evaluationDepth: { included: true, value: "Advanced review controls" },
      exports: { included: true, value: "Team-ready exports" },
      teamTools: { included: true, value: "Admin and cohorts" },
      support: { included: true, value: "Priority onboarding" },
    },
  },
];

const env = (key) => String(process.env[`REACT_APP_${key}`] || "").trim();

export const paymentGatewayConfig = {
  merchantName: env("PAYMENT_MERCHANT_NAME") || "Evaluate Yourself",
  supportEmail: env("PAYMENT_SUPPORT_EMAIL") || "support@evaluateyourself.ai",
  defaultCurrency: env("PAYMENT_DEFAULT_CURRENCY") || "INR",
  checkoutUrl: env("PAYMENT_CHECKOUT_URL"),
  methods: [
    {
      key: "link",
      label: "Link",
      helper: "Fast wallet checkout when your payment provider supports Link.",
      accent: "#00d66b",
    },
    {
      key: "card",
      label: "Card",
      helper: "Visa, Mastercard, RuPay, Amex, and international cards.",
      accent: "#0f172a",
    },
    {
      key: "upi",
      label: "UPI",
      helper: "India payments through UPI apps and QR-supported gateways.",
      accent: "#0f766e",
    },
    {
      key: "apple_pay",
      label: "Apple Pay",
      helper: "Wallet checkout on supported Apple devices.",
      accent: "#111827",
    },
    {
      key: "google_pay",
      label: "Google Pay",
      helper: "Wallet checkout on supported browsers and Android devices.",
      accent: "#2563eb",
    },
  ],
};

export function findPricingPlan(planKey) {
  return pricingPlans.find((plan) => plan.key === planKey) || pricingPlans[1];
}

export function resolvePaymentUrl() {
  return env("PAYMENT_CHECKOUT_URL");
}
