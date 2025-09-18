import { Suspense, useState, useEffect } from 'react';
import { Box, CircularProgress, useTheme } from '@mui/material';

/**
 * Utility for code splitting and lazy loading components
 * 
 * @param {Function} importFunc - Dynamic import function for the component
 * @param {Object} options - Configuration options
 * @param {JSX.Element} options.fallback - Fallback UI during loading
 * @param {boolean} options.preload - Whether to preload the component
 * @param {number} options.delay - Artificial delay for testing (ms)
 * @returns {React.LazyExoticComponent} Lazy loaded component
 */
export const lazyLoad = (importFunc, options = {}) => {
  const { 
    fallback = null, 
    preload = false,
    delay = 0
  } = options;

  // Create lazy component with optional artificial delay (for testing)
  const LazyComponent = React.lazy(() => {
    const promise = importFunc();
    
    if (delay > 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          promise.then(resolve);
        }, delay);
      });
    }
    
    return promise;
  });

  // Preload the component if requested
  if (preload) {
    importFunc();
  }

  // Return a wrapped component that handles suspense internally
  return (props) => (
    <Suspense fallback={fallback || <LoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Default loading fallback component
 */
export const LoadingFallback = () => {
  const theme = useTheme();
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        width: '100%', 
        height: '100%',
        minHeight: '200px',
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  );
};

/**
 * Hook for deferred loading of components
 * Only loads the component when it's needed
 * 
 * @param {Function} loader - Function that returns a dynamic import
 * @param {Object} options - Configuration options
 * @param {boolean} options.immediate - Load immediately rather than on demand
 * @returns {[any, boolean, Error]} [Component, isLoading, error]
 */
export const useDeferredLoad = (loader, options = {}) => {
  const { immediate = false } = options;
  const [Component, setComponent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (Component) return;
    
    setIsLoading(true);
    try {
      const module = await loader();
      setComponent(() => module.default || module);
    } catch (err) {
      console.error('Failed to load component:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (immediate) {
      load();
    }
  }, [immediate]);

  return [Component, isLoading, error, load];
};

/**
 * Performance monitoring utility
 * Measures component render times and reports performance metrics
 * 
 * @param {string} componentName - Name of the component being monitored
 * @returns {Object} Performance monitoring methods
 */
export const usePerformanceMonitor = (componentName) => {
  const startTime = performance.now();
  
  useEffect(() => {
    const renderTime = performance.now() - startTime;
    console.log(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`);
    
    return () => {
      const totalMountedTime = performance.now() - startTime;
      console.log(`[Performance] ${componentName} was mounted for ${totalMountedTime.toFixed(2)}ms`);
    };
  }, [componentName]);

  const logEvent = (eventName) => {
    const eventTime = performance.now() - startTime;
    console.log(`[Performance] ${componentName} - ${eventName}: ${eventTime.toFixed(2)}ms`);
  };

  return { logEvent };
};