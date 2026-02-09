import React from "react";
import { Box, Container, Divider, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { footerBrand, footerLinks } from "../config/footerConfig";

const isExternalLink = (href) => {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        borderTop: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2, md: 4 }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ py: { xs: 3, md: 4 } }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {footerBrand.displayName}
            </Typography>
            {footerBrand.tagline ? (
              <Typography variant="body2" color="text.secondary">
                {footerBrand.tagline}
              </Typography>
            ) : null}
          </Box>

          {footerLinks.length > 0 ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              {footerLinks.map((link) => {
                const external = isExternalLink(link.href);
                const linkProps = external
                  ? { href: link.href, target: "_blank", rel: "noopener noreferrer" }
                  : { component: RouterLink, to: link.href };

                return (
                  <MuiLink
                    key={link.label}
                    underline="hover"
                    color="text.secondary"
                    variant="body2"
                    {...linkProps}
                  >
                    {link.label}
                  </MuiLink>
                );
              })}
            </Stack>
          ) : null}
        </Stack>

        <Divider />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ py: 2 }}
        >
          <Typography variant="caption" color="text.secondary">
            © {year} {footerBrand.legalName || footerBrand.displayName}. All rights reserved.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
