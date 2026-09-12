import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runLiveSmoke } from './live-smoke.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

function option(name) {
  const exact = `--${name}`
  const prefix = `${exact}=`
  const index = process.argv.findIndex((value) => value === exact || value.startsWith(prefix))
  if (index === -1) return undefined
  const value = process.argv[index]
  if (value.startsWith(prefix)) return value.slice(prefix.length)
  return process.argv[index + 1]
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  return result.stdout.trim()
}

function placeholder(value) {
  return !value || /your-|example|replace|todo|localhost/i.test(value)
}

function normalizedRepositoryUrl(value) {
  if (!value) return value
  if (value.startsWith('git@github.com:')) {
    return `https://github.com/${value.slice('git@github.com:'.length).replace(/\.git$/, '')}`
  }
  if (value.startsWith('git@gitlab.com:')) {
    return `https://gitlab.com/${value.slice('git@gitlab.com:'.length).replace(/\.git$/, '')}`
  }
  if (/^https?:\/\//.test(value)) {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\.git$/, '').replace(/\/$/, '')
    return url.href.replace(/\/$/, '')
  }
  return value.replace(/\.git$/, '')
}

async function loadConfiguration() {
  const configPath = option('config') || 'submission.json'
  let file = {}
  try {
    file = JSON.parse(await readFile(path.resolve(root, configPath), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return {
    liveUrl: option('url') || process.env.LIVE_URL || file.liveUrl,
    repositoryUrl:
      option('repo') || process.env.REPOSITORY_URL || file.repositoryUrl || normalizedRepositoryUrl(git('remote', 'get-url', 'origin')),
    videoUrl: option('video') || process.env.VIDEO_URL || file.videoUrl,
    videoSeconds: Number(option('video-seconds') || process.env.VIDEO_SECONDS || file.videoSeconds),
    videoSizeMb: Number(option('video-size-mb') || process.env.VIDEO_SIZE_MB || file.videoSizeMb),
  }
}

async function checkRepository(repositoryUrl) {
  assert.ok(!placeholder(repositoryUrl), 'Set a real public repository URL.')
  const url = new URL(repositoryUrl)
  assert.equal(url.protocol, 'https:', 'Repository URL must use HTTPS for the submission.')
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': 'life-rpg-submission-check/1.0' },
  })
  assert.equal(response.status, 200, 'Repository must be publicly reachable without authentication.')
}

async function checkVideo({ videoUrl, videoSeconds, videoSizeMb }) {
  assert.ok(!placeholder(videoUrl), 'Set the public walkthrough video URL.')
  assert.ok(Number.isFinite(videoSeconds), 'Record and provide videoSeconds in submission.json.')
  assert.ok(videoSeconds >= 90 && videoSeconds <= 180, 'Walkthrough must be between 90 and 180 seconds.')
  assert.ok(Number.isFinite(videoSizeMb), 'Measure the final video and provide videoSizeMb in submission.json.')
  assert.ok(videoSizeMb > 0 && videoSizeMb < 100, 'Walkthrough must remain under 100 MB.')

  const url = new URL(videoUrl)
  assert.equal(url.protocol, 'https:', 'Walkthrough URL must use HTTPS.')
  let response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': 'life-rpg-submission-check/1.0' },
  })
  if (!response.ok || response.status === 405) {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { Range: 'bytes=0-0', 'user-agent': 'life-rpg-submission-check/1.0' },
    })
  }
  assert.ok(response.ok, 'Walkthrough URL must be publicly reachable without authentication.')

  const contentRange = response.headers.get('content-range')
  const contentLength = Number(response.headers.get('content-length'))
  const remoteBytes = contentRange ? Number(contentRange.split('/').at(-1)) : contentLength
  if (Number.isFinite(remoteBytes) && /video\//i.test(response.headers.get('content-type') || '')) {
    assert.ok(remoteBytes < MAX_VIDEO_BYTES, 'Remote video response is 100 MB or larger.')
  }
}

async function main() {
  const configuration = await loadConfiguration()

  const requiredFiles = [
    'README.md',
    'package-lock.json',
    'server/.env.example',
    'client/.env.example',
    'render.yaml',
    '.github/workflows/verify.yml',
    'docs/DEPLOYMENT.md',
    'docs/SUBMISSION.md',
    'docs/WALKTHROUGH.md',
  ]
  await Promise.all(requiredFiles.map((file) => access(path.join(root, file))))

  const branch = git('branch', '--show-current')
  assert.equal(branch, 'main', 'Final submission must be pushed from the main branch.')
  const commitCount = Number(git('rev-list', '--count', 'HEAD'))
  assert.ok(commitCount >= 3, 'Repository must contain at least three chronological commits.')
  assert.equal(git('status', '--porcelain'), '', 'Commit all release changes before running submission:check.')

  const readme = await readFile(path.join(root, 'README.md'), 'utf8')
  for (const phrase of ['## Local setup', '## Environment', '## Deployment', '## Submission']) {
    assert.ok(readme.includes(phrase), `README is missing ${phrase}.`)
  }

  await checkRepository(configuration.repositoryUrl)
  await runLiveSmoke(configuration.liveUrl)
  await checkVideo(configuration)

  console.log(
    JSON.stringify({
      event: 'submission.check_passed',
      branch,
      commitCount,
      repositoryUrl: configuration.repositoryUrl,
      liveUrl: configuration.liveUrl,
      videoSeconds: configuration.videoSeconds,
      videoSizeMb: configuration.videoSizeMb,
    }),
  )
}

await main()
