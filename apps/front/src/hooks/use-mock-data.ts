import type { MockOptions } from '@/types/view-state';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useViewState } from './use-view-state';

export function useMockData<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = [],
  options: MockOptions = {}
) {
  const { data, loading, error, setData, setLoading, setError } = useViewState<T>();
  const searchParams = useSearchParams();

  const load = useCallback(async (isTransition = false) => {
    // Determine delay based on rules: 
    // Initial: 1200-2000ms, Transition: 600-1000ms
    const delay = options.delay ?? (isTransition ? 800 : 1500);
    
    setLoading(true);
    setError(false);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Global debug overrides via URL
      const forceError = searchParams.get('mock_error') === '1' || options.shouldError;
      const forceEmpty = searchParams.get('mock_empty') === '1' || options.isEmpty;

      if (forceError) {
        throw new Error('数据加载失败（Mock）');
      }

      if (forceEmpty) {
        setData(null);
      } else {
        const result = await fetcher();
        setData(result);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetcher, options.delay, options.shouldError, options.isEmpty, searchParams, setData, setError, setLoading, ...dependencies]);

  useEffect(() => {
    load();
  }, dependencies);

  return { data, loading, error, reload: () => load(true) };
}
