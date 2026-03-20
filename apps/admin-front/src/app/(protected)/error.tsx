'use client';

import { useEffect, useState } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#f6f7f9',
        color: '#1f2937',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          textAlign: 'center',
        }}
      >
        {dismissed ? (
          <>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              已关闭错误提示
            </div>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#111827',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              页面发生错误
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              请打开控制台查看详细错误信息
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#111827',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
