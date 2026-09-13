import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testDirectories = ['server/tests', 'shared/tests']

async function testFiles() {
  const files = []

  for (const directory of testDirectories) {
    const absoluteDirectory = path.join(root, directory)
    const entries = await readdir(absoluteDirectory, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.join(absoluteDirectory, entry.name))
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function runTestFile(file) {
  return new Promise((resolve, reject) => {
    const relative = path.relative(root, file)
    console.log(`\n[test] ${relative}`)

    // PGlite embeds PostgreSQL as WebAssembly. On recent Node/V8 builds, letting
    // the test runner execute that WASM through the optimizing tier can abort the
    // process with "Fatal process out of memory: Zone" before assertions run.
    // Run one isolated test file at a time directly with Node and keep WASM on
    // V8's baseline Liftoff compiler. This preserves file isolation while
    // avoiding the native compiler crash; it does not relax or skip any tests.
    const child = spawn(
      process.execPath,
      ['--liftoff-only', file],
      {
        cwd: root,
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' },
        stdio: 'inherit',
      },
    )

    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal, relative }))
  })
}

const failures = []
for (const file of await testFiles()) {
  const result = await runTestFile(file)
  if (result.code !== 0) failures.push(result)
}

if (failures.length > 0) {
  console.error('\nTest files failed:')
  for (const failure of failures) {
    const detail = failure.signal ? `signal ${failure.signal}` : `exit ${failure.code}`
    console.error(`- ${failure.relative} (${detail})`)
  }
  process.exitCode = 1
} else {
  console.log('\nAll test files passed.')
}
