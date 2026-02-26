'use client'

import { useEffect } from 'react'
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body>
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
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              系统发生错误
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              请打开控制台查看详细错误信息
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
          </div>
        </div>
      </body>
    </html>
  )
}
