import React, { useState, useEffect, Suspense } from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';

/**
 * Optimized Image component that supports lazy loading and fallback
 * 
 * @param {Object} props - Component properties
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alternative text for accessibility
 * @param {number} props.width - Image width
 * @param {number} props.height - Image height
 * @param {string} props.objectFit - CSS object-fit property
 * @param {Object} props.sx - Additional MUI styling
 * @param {string} props.quality - Image quality (low, medium, high)
 * @param {boolean} props.lazy - Whether to lazy load the image
 * @param {string} props.fallbackSrc - Fallback image source if main image fails to load
 * @returns {JSX.Element} Optimized image component
 */
export const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  objectFit = 'cover',
  sx = {},
  quality = 'high',
  lazy = true,
  fallbackSrc = '',
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const theme = useTheme();

  // Determine image quality factors
  const qualityFactors = {
    low: 0.6,
    medium: 0.8,
    high: 1.0
  };

  // Generate optimized source URL (in a real app, this would use an image processing service)
  const optimizedSrc = src;

  // Handle image loading
  const handleLoad = () => {
    setLoaded(true);
  };

  // Handle image loading error
  const handleError = () => {
    setError(true);
    if (fallbackSrc) {
      console.warn(`Image failed to load: ${src}, using fallback`);
    } else {
      console.error(`Image failed to load: ${src}`);
    }
  };

  // Calculate aspect ratio for responsive sizing
  const aspectRatio = height && width ? width / height : undefined;

  // Combine styles
  const combinedSx = {
    width: width || '100%',
    height: height || 'auto',
    objectFit,
    transition: 'opacity 0.3s ease-in-out',
    opacity: loaded ? 1 : 0,
    display: error && !fallbackSrc ? 'none' : 'block',
    ...(aspectRatio && { aspectRatio }),
    ...sx
  };

  return (
    <Box 
      sx={{ 
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        overflow: 'hidden',
        borderRadius: theme.shape.borderRadius,
        ...(aspectRatio && { aspectRatio }),
      }}
    >
      {!loaded && !error && (
        <Skeleton 
          variant="rectangular" 
          width="100%" 
          height="100%" 
          animation="wave"
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: theme.palette.grey[200],
          }}
        />
      )}
      <Box
        component="img"
        src={error && fallbackSrc ? fallbackSrc : optimizedSrc}
        alt={alt}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={handleLoad}
        onError={handleError}
        sx={combinedSx}
        {...props}
      />
    </Box>
  );
};

/**
 * LazyComponent - Wraps any component for lazy loading with suspense
 * 
 * @param {React.ComponentType} Component - The component to be lazy loaded
 * @param {Object} fallback - The fallback UI to show while loading
 * @returns {JSX.Element} Lazy loaded component with suspense
 */
export const LazyComponent = ({ component: Component, fallback, ...props }) => {
  return (
    <Suspense fallback={fallback || <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />}>
      <Component {...props} />
    </Suspense>
  );
};

/**
 * Creates a lazy loaded component
 * 
 * @param {Function} importFunc - Dynamic import function
 * @returns {React.LazyExoticComponent} Lazy loaded component
 */
export const createLazyComponent = (importFunc) => {
  return React.lazy(() => importFunc());
};

/**
 * IntersectionObserver hook for lazy loading based on viewport visibility
 * 
 * @param {Object} options - IntersectionObserver options
 * @param {Element} options.root - The element used as viewport for checking visibility
 * @param {string} options.rootMargin - Margin around the root
 * @param {number|number[]} options.threshold - Percentage of the target's visibility
 * @returns {[React.RefObject, boolean]} Reference object and visibility state
 */
export const useIntersectionObserver = (options = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, {
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
      threshold: options.threshold || 0
    });

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options.root, options.rootMargin, options.threshold]);

  return [ref, isVisible];
};