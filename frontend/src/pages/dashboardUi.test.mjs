import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('dashboard summary cards expose request and token breakdowns', () => {
  const page = read('pages/Dashboard.vue')

  assert.doesNotMatch(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.requests\) \}\}<\/strong>\s*<span>Requests<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.successes\) \}\}<\/strong>\s*<span>Success<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.failures\) \}\}<\/strong>\s*<span>Failure<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatLatency\(statsSummary\.successAvgDurationMs\) \}\}<\/strong>\s*<span>Latency<\/span>/,
  )
  assert.doesNotMatch(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.totalTokens\) \}\}<\/strong>\s*<span>Tokens<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.inputTokens\) \}\}<\/strong>\s*<span>Input<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.inputCacheTokens\) \}\}<\/strong>\s*<span>Cache<\/span>/,
  )
  assert.match(
    page,
    /<strong>\{\{ formatCompactNumber\(statsSummary\.outputTokens\) \}\}<\/strong>\s*<span>Output<\/span>/,
  )
})
