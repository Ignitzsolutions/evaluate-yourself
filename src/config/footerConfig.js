// src/config/footerConfig.js

const getEnvVar = (key, fallback = "") => {
  return process.env[`REACT_APP_${key}`] || fallback;
};

export const footerBrand = {
  displayName: getEnvVar("COMPANY_NAME", "Evaluate Yourself"),
  legalName: getEnvVar("COMPANY_LEGAL_NAME", "Evaluate Yourself"),
  tagline: getEnvVar(
    "COMPANY_TAGLINE",
    "Practice real interviews. Improve with feedback."
  ),
};

export const footerLinks = [
  {
    label: "Pricing",
    href: "/pricing",
  },
  {
    label: "Privacy",
    href: getEnvVar("PRIVACY_URL"),
  },
  {
    label: "Terms",
    href: getEnvVar("TERMS_URL"),
  },
  {
    label: "Support",
    href: getEnvVar("SUPPORT_URL"),
  },
  {
    label: "Status",
    href: getEnvVar("STATUS_URL"),
  },
].filter((link) => Boolean(link.href));
