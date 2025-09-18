import { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Link, 
  Tooltip,
  VisuallyHidden,
  useTheme
} from '@mui/material';

/**
 * SkipLink - Provides keyboard users a way to skip navigation
 * and jump straight to the main content
 */
export const SkipLink = () => {
  const theme = useTheme();
  
  return (
    <Link
      href="#main-content"
      sx={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        padding: theme.spacing(1, 2),
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        zIndex: theme.zIndex.tooltip,
        transition: 'top 0.2s ease-in-out',
        '&:focus': {
          top: 0,
          outline: `3px solid ${theme.palette.secondary.main}`,
        },
      }}
    >
      Skip to main content
    </Link>
  );
};

/**
 * A11yAnnouncer - Screen reader announcements for dynamic content changes
 * 
 * @param {Object} props
 * @param {string} props.message - Message to announce to screen readers
 * @param {string} props.politeness - ARIA live region politeness setting
 */
export const A11yAnnouncer = ({ 
  message = '', 
  politeness = 'polite' // 'polite' or 'assertive'
}) => {
  return (
    <VisuallyHidden>
      <div aria-live={politeness} role="status">
        {message}
      </div>
    </VisuallyHidden>
  );
};

/**
 * Hook to manage focus trapping within a modal or dialog
 * 
 * @param {boolean} isActive - Whether focus trap is active
 * @returns {React.RefObject} Ref to attach to the container element
 */
export const useFocusTrap = (isActive = true) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    // Auto-focus first element when trap becomes active
    firstElement.focus();
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);
  
  return containerRef;
};

/**
 * AccessibleButton - Enhanced button with improved accessibility features
 * 
 * @param {Object} props - Component properties
 * @param {string} props.label - Text label for the button
 * @param {Function} props.onClick - Click handler
 * @param {string} props.description - Extended description for screen readers
 * @param {Object} props.sx - Additional styling
 * @param {string} props.variant - Button variant (contained, outlined, text)
 * @param {string} props.color - Button color
 * @param {React.ReactNode} props.children - Button content
 */
export const AccessibleButton = ({ 
  label, 
  onClick, 
  description,
  sx = {},
  variant = 'contained',
  color = 'primary',
  children,
  ...props
}) => {
  const buttonId = useRef(`button-${Math.random().toString(36).substr(2, 9)}`);
  const descriptionId = description ? `${buttonId.current}-desc` : undefined;

  return (
    <>
      <Button
        id={buttonId.current}
        onClick={onClick}
        variant={variant}
        color={color}
        aria-describedby={descriptionId}
        sx={sx}
        {...props}
      >
        {label || children}
      </Button>
      {description && (
        <VisuallyHidden>
          <span id={descriptionId}>{description}</span>
        </VisuallyHidden>
      )}
    </>
  );
};

/**
 * UseKeyboardNavigation - Hook for keyboard navigation between items
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.keys - Keys to listen for (e.g., ['ArrowUp', 'ArrowDown'])
 * @param {number} options.itemCount - Number of items to navigate between
 * @param {Function} options.onSelect - Callback when an item is selected
 * @returns {[number, Function]} Selected index and key handler
 */
export const useKeyboardNavigation = ({
  keys = ['ArrowUp', 'ArrowDown'],
  itemCount = 0,
  onSelect = () => {},
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const handleKeyDown = (e) => {
    if (!keys.includes(e.key)) return;
    
    e.preventDefault();
    
    let newIndex = selectedIndex;
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      newIndex = (selectedIndex + 1) % itemCount;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      newIndex = (selectedIndex - 1 + itemCount) % itemCount;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = itemCount - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      onSelect(selectedIndex);
      return;
    }
    
    setSelectedIndex(newIndex);
    onSelect(newIndex);
  };
  
  return [selectedIndex, handleKeyDown];
};

/**
 * ReduceMotion - Hook to respect user's reduce motion preference
 * 
 * @returns {boolean} Whether reduce motion is preferred
 */
export const useReduceMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  return prefersReducedMotion;
};