import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Work as InterviewsIcon,
  PlayArrow,
  Logout,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser, useClerk } from "@clerk/clerk-react";   // ✅ Clerk

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsIcon /> },
  { label: 'History', path: '/history', icon: <HistoryIcon /> },
  { label: 'Interviews', path: '/interviews', icon: <InterviewsIcon /> },
];

// Logo component using brand image
const Logo = ({ onClick }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <img 
        src="/assets/logo.png" 
        alt="Evaluate Yourself Logo" 
        style={{ height: '100px', width: 'auto' }}
      />
    </Box>
  );
};

export default function Navbar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Clerk: signOut used for logout
  const { signOut } = useClerk();

  const handleNavigation = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    await signOut();        // ✅ Clerk logout
    navigate('/login');
    setDrawerOpen(false);
  };

  const handleNewInterview = () => {
    navigate('/interviews');
    setDrawerOpen(false);
  };

  const isActivePath = (path) => location.pathname === path;

  const drawer = (
    <Box sx={{ width: 280 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Logo />
        <IconButton onClick={() => setDrawerOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>

      <List sx={{ p: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={isActivePath(item.path)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '15',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '25',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActivePath(item.path)
                    ? theme.palette.primary.main
                    : 'inherit',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: isActivePath(item.path) ? 600 : 400,
                  color: isActivePath(item.path)
                    ? theme.palette.primary.main
                    : 'inherit',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2 }} />

      <Box sx={{ p: 2 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PlayArrow />}
          onClick={handleNewInterview}
          sx={{ mb: 1.5 }}
        >
          New Interview
        </Button>
        <Button
          variant="outlined"
          color="error"
          fullWidth
          startIcon={<Logout />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Logo */}
          <Logo onClick={() => navigate('/')} />

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  startIcon={item.icon}
                  sx={{
                    color: isActivePath(item.path)
                      ? theme.palette.primary.main
                      : theme.palette.text.secondary,
                    fontWeight: isActivePath(item.path) ? 600 : 500,
                    position: 'relative',
                    '&::after': isActivePath(item.path)
                      ? {
                          content: '""',
                          position: 'absolute',
                          bottom: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '60%',
                          height: 3,
                          borderRadius: '3px 3px 0 0',
                          backgroundColor: theme.palette.primary.main,
                        }
                      : {},
                    '&:hover': {
                      backgroundColor: theme.palette.primary.main + '10',
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Right Side Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isMobile ? (
              <IconButton
                edge="end"
                onClick={() => setDrawerOpen(true)}
                sx={{ color: theme.palette.text.primary }}
              >
                <MenuIcon />
              </IconButton>
            ) : (
              <>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handleNewInterview}
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                    },
                  }}
                >
                  New Interview
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Logout />}
                  onClick={handleLogout}
                  size="small"
                >
                  Logout
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px 0 0 16px',
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}