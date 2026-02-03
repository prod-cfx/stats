import type { NextPageContext } from 'next'

export default function ErrorPage({ statusCode }: { statusCode?: number }) {
  const code = statusCode ?? 500
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em' }}>{code}</div>
        <div style={{ marginTop: 12, opacity: 0.8 }}>An unexpected error has occurred.</div>
        <div style={{ marginTop: 16 }}>
          <a href="/zh">Back to Home</a>
        </div>
      </div>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500
  return { statusCode }
}

