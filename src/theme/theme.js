import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const colors = {
  primary: {
    main: '#0f766e',
    light: '#14b8a6',
    dark: '#115e59',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#0f172a',
    light: '#334155',
    dark: '#020617',
    contrastText: '#ffffff',
  },
  success: {
    main: '#0f766e',
    light: '#14b8a6',
    dark: '#115e59',
  },
  error: {
    main: '#dc2626',
    light: '#ef4444',
    dark: '#991b1b',
  },
  warning: {
    main: '#d97706',
    light: '#f59e0b',
    dark: '#b45309',
  },
  info: {
    main: '#475569',
    light: '#94a3b8',
    dark: '#334155',
  },
  grey: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  background: {
    default: '#f7f6f3',
    paper: '#ffffff',
    dark: '#ebe7dc',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    disabled: '#94a3b8',
  },
};

let theme = createTheme({
  palette: {
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
    grey: colors.grey,
    background: colors.background,
    text: colors.text,
  },
  typography: {
    fontFamily: ['Manrope', 'Inter', 'system-ui', 'sans-serif'].join(','),
    h1: { fontWeight: 800, fontSize: '2.75rem', lineHeight: 1.04, letterSpacing: '-0.03em' },
    h2: { fontWeight: 800, fontSize: '2.25rem', lineHeight: 1.08, letterSpacing: '-0.025em' },
    h3: { fontWeight: 750, fontSize: '1.9rem', lineHeight: 1.12, letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.18, letterSpacing: '-0.015em' },
    h5: { fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.25 },
    h6: { fontWeight: 700, fontSize: '1rem', lineHeight: 1.3 },
    subtitle1: { fontSize: '1rem', lineHeight: 1.55, color: colors.text.secondary },
    subtitle2: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    button: {
      textTransform: 'none',
      fontWeight: 700,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 18,
  },
  spacing: (factor) => `${0.5 * factor}rem`,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          width: '100%',
          minWidth: 320,
          minHeight: '100dvh',
          overflowX: 'hidden',
          backgroundColor: colors.background.default,
          color: colors.text.primary,
          textRendering: 'optimizeLegibility',
          WebkitFontSmoothing: 'antialiased',
        },
        '::selection': {
          backgroundColor: 'rgba(15, 118, 110, 0.16)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          padding: '0.7rem 1.2rem',
          minHeight: 44,
          boxShadow: 'none',
          transition: 'transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
          '&:hover': {
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          boxShadow: '0 12px 28px rgba(15, 118, 110, 0.18)',
          '&:hover': {
            boxShadow: '0 16px 34px rgba(15, 118, 110, 0.2)',
          },
        },
        outlined: {
          borderColor: 'rgba(148, 163, 184, 0.5)',
          backgroundColor: 'rgba(255,255,255,0.92)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 16px 44px rgba(15, 23, 42, 0.06)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.82)',
          color: colors.text.primary,
          boxShadow: '0 1px 0 rgba(148,163,184,0.22)',
          backdropFilter: 'blur(16px) saturate(140%)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 76,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 18px 52px rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(148, 163, 184, 0.14)',
          overflow: 'hidden',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '1.5rem',
          '&:last-child': {
            paddingBottom: '1.5rem',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 16,
            backgroundColor: '#ffffff',
            transition: 'box-shadow 140ms ease, border-color 140ms ease, transform 140ms ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(15, 118, 110, 0.35)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary.main,
              borderWidth: 1.5,
            },
          },
          '& .MuiInputLabel-root': {
            color: colors.text.secondary,
            fontWeight: 600,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: colors.text.primary,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: 'rgba(148, 163, 184, 0.34)',
        },
        input: {
          paddingTop: '0.95rem',
          paddingBottom: '0.95rem',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          backgroundImage: 'none',
          boxShadow: '-12px 0 42px rgba(15, 23, 42, 0.12)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.grey[800],
          fontSize: '0.75rem',
          padding: '0.55rem 0.8rem',
          borderRadius: 10,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(148, 163, 184, 0.16)',
        },
      },
    },
  },
});

theme = responsiveFontSizes(theme);

export default theme;
