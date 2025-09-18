import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Button, 
  useTheme, 
  Divider,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Link,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { OptimizedImage } from '../utils/imageOptimization';
import { LoadingFallback } from '../utils/performanceOptimization';
import { AccessibleButton, SkipLink } from '../utils/accessibility';

// Example component to showcase the new theme and accessibility improvements
const StyleGuide = () => {
  const theme = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);

  // Sample color variables from theme
  const colors = [
    { name: 'Primary', color: theme.palette.primary.main, text: theme.palette.primary.contrastText },
    { name: 'Secondary', color: theme.palette.secondary.main, text: theme.palette.secondary.contrastText },
    { name: 'Error', color: theme.palette.error.main, text: theme.palette.error.contrastText },
    { name: 'Warning', color: theme.palette.warning.main, text: theme.palette.warning.contrastText },
    { name: 'Info', color: theme.palette.info.main, text: theme.palette.info.contrastText },
    { name: 'Success', color: theme.palette.success.main, text: theme.palette.success.contrastText },
  ];

  // Toggle reduced motion example
  const handleToggleReducedMotion = () => {
    setReducedMotion(!reducedMotion);
  };

  // Example animation style that respects reduced motion preferences
  const getAnimationStyle = (duration = 0.3) => {
    return {
      transition: reducedMotion ? 'none' : `all ${duration}s ease-in-out`,
      '&:hover': {
        transform: reducedMotion ? 'none' : 'translateY(-5px)',
        boxShadow: reducedMotion ? 'none' : theme.shadows[8],
      }
    };
  };

  return (
    <Box>
      <SkipLink />
      <Typography variant="h2" component="h1" gutterBottom>
        UI Modernization Style Guide
      </Typography>

      <FormControlLabel
        control={<Switch checked={reducedMotion} onChange={handleToggleReducedMotion} />}
        label="Reduced Motion"
        sx={{ mb: 4 }}
      />

      <Typography variant="h4" component="h2" gutterBottom>
        Color Palette
      </Typography>
      <Grid container spacing={2} sx={{ mb: 6 }}>
        {colors.map((item, index) => (
          <Grid item xs={6} sm={4} md={2} key={index}>
            <Paper
              sx={{
                bgcolor: item.color,
                color: item.text,
                p: 2,
                textAlign: 'center',
                height: '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: theme.shape.borderRadius,
                ...getAnimationStyle(),
              }}
              elevation={3}
            >
              <Typography variant="subtitle1">{item.name}</Typography>
              <Typography variant="caption">{item.color}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" component="h2" gutterBottom>
        Typography
      </Typography>
      <Paper sx={{ p: 3, mb: 6 }}>
        <Typography variant="h1" gutterBottom>h1. Heading</Typography>
        <Typography variant="h2" gutterBottom>h2. Heading</Typography>
        <Typography variant="h3" gutterBottom>h3. Heading</Typography>
        <Typography variant="h4" gutterBottom>h4. Heading</Typography>
        <Typography variant="h5" gutterBottom>h5. Heading</Typography>
        <Typography variant="h6" gutterBottom>h6. Heading</Typography>
        <Typography variant="subtitle1" gutterBottom>subtitle1. Lorem ipsum dolor sit amet, consectetur adipisicing elit.</Typography>
        <Typography variant="subtitle2" gutterBottom>subtitle2. Lorem ipsum dolor sit amet, consectetur adipisicing elit.</Typography>
        <Typography variant="body1" gutterBottom>body1. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis tenetur unde suscipit, quam beatae rerum inventore consectetur, neque doloribus, cupiditate numquam dignissimos laborum fugiat deleniti.</Typography>
        <Typography variant="body2" gutterBottom>body2. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis tenetur unde suscipit, quam beatae rerum inventore consectetur, neque doloribus, cupiditate numquam dignissimos laborum fugiat deleniti.</Typography>
        <Typography variant="button" display="block" gutterBottom>button text</Typography>
        <Typography variant="caption" display="block" gutterBottom>caption text</Typography>
        <Typography variant="overline" display="block" gutterBottom>overline text</Typography>
      </Paper>

      <Typography variant="h4" component="h2" gutterBottom>
        Components
      </Typography>
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...getAnimationStyle() }}>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Buttons
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Button variant="contained" color="primary">Primary</Button>
                <Button variant="contained" color="secondary">Secondary</Button>
                <Button variant="contained" color="error">Error</Button>
                <Button variant="outlined" color="primary">Outlined</Button>
                <Button variant="text" color="primary">Text</Button>
              </Box>
              
              <Typography variant="h6" component="h4" gutterBottom sx={{ mt: 2 }}>
                Accessible Buttons
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <AccessibleButton 
                  label="Accessible Button" 
                  description="This button has an extended description for screen readers"
                  variant="contained"
                  color="primary"
                />
                <Tooltip title="Information tooltip">
                  <AccessibleButton 
                    label="With Tooltip" 
                    variant="outlined"
                    color="info"
                  />
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ ...getAnimationStyle() }}>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Optimized Images
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <OptimizedImage 
                  src="https://picsum.photos/seed/picsum/400/200"
                  alt="Example of lazy loaded image"
                  width="100%"
                  height={200}
                  lazy={true}
                />
                <Typography variant="caption" align="center">
                  This image uses the OptimizedImage component with lazy loading and fallbacks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ ...getAnimationStyle() }}>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Loading States
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius }}>
                    <LoadingFallback />
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    Default loading fallback component
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius }}>
                    <OptimizedImage 
                      src=""
                      alt="Loading placeholder"
                      width="100%"
                      height={200}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    Image loading skeleton
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h4" component="h2" gutterBottom>
        Accessibility Features
      </Typography>
      <Paper sx={{ p: 3, mb: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Implemented Features</Typography>
            <ul>
              <li>
                <Typography variant="body1" gutterBottom>
                  Skip links for keyboard navigation
                </Typography>
              </li>
              <li>
                <Typography variant="body1" gutterBottom>
                  ARIA labels and descriptions for complex interactions
                </Typography>
              </li>
              <li>
                <Typography variant="body1" gutterBottom>
                  Keyboard focus management utilities
                </Typography>
              </li>
              <li>
                <Typography variant="body1" gutterBottom>
                  Reduced motion preferences support
                </Typography>
              </li>
              <li>
                <Typography variant="body1" gutterBottom>
                  Color contrast compliance with WCAG 2.1
                </Typography>
              </li>
              <li>
                <Typography variant="body1" gutterBottom>
                  Screen reader announcements for dynamic content
                </Typography>
              </li>
            </ul>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Resources</Typography>
            <Link href="https://www.w3.org/WAI/WCAG21/quickref/" target="_blank" rel="noopener">
              WCAG 2.1 Quick Reference
            </Link>
            <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
              The official quick reference to Web Content Accessibility Guidelines.
            </Typography>
            
            <Link href="https://mui.com/material-ui/guides/accessibility/" target="_blank" rel="noopener">
              Material UI Accessibility Guide
            </Link>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Accessibility features and recommendations for Material UI components.
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default StyleGuide;