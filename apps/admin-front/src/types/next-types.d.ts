// Workaround for Next.js 15.5.7 types.js module resolution issue
// This file provides type declarations for 'next/types.js' which is imported by generated validator.ts

declare module 'next/types.js' {
  export * from 'next/dist/types'
  export { default } from 'next/dist/types'
}
