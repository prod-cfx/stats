#!/usr/bin/env node

const { spawn } = require('node:child_process')

const args = process.argv.slice(2)

const child = spawn('dx', args, {
  stdio: 'inherit',
  shell: false,
})

child.on('error', err => {
  console.error(err?.message || String(err))
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code)
  process.exit(signal ? 1 : 0)
})
