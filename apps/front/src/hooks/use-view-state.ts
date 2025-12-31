import type { ViewState } from '@/types/view-state';
import { useCallback, useState } from 'react';

export function useViewState<T>(initialData: T | null = null) {
  const [state, setState] = useState<ViewState<T>>({
    data: initialData,
    loading: false,
    error: false,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: boolean) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  const setData = useCallback((data: T | null) => {
    setState({ data, loading: false, error: false });
  }, []);

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: false });
  }, [initialData]);

  return {
    ...state,
    setLoading,
    setError,
    setData,
    reset,
  };
}
