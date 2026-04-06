import React from "react";
import { Box, Typography } from "@mui/material";

export default function MacbookStage({ children, caption, title }) {
  return (
    <Box className="presentation-device-shell">
      <Box className="presentation-device-topbar">
        <Box className="presentation-device-dots">
          <span />
          <span />
          <span />
        </Box>
        <Typography className="presentation-device-name">
          {title || "Evaluate Yourself"}
        </Typography>
      </Box>
      <Box className="presentation-device-screen">
        {children}
      </Box>
      {caption ? (
        <Typography className="presentation-device-caption">
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
