import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('usage logs expanded details show response bodies for errors and zero-token 200 responses', () => {
  const table = read('components/usageLogs/UsageLogsTable.vue')

  assert.doesNotMatch(table, /<span class="detail-label">Input Tokens:<\/span>/)
  assert.doesNotMatch(table, /<span class="detail-label">Cache Tokens:<\/span>/)
  assert.doesNotMatch(table, /<span class="detail-label">Output Tokens:<\/span>/)
  assert.match(table, /<span class="detail-label">Request ID:<\/span>/)
  assert.match(table, /<span class="detail-label">Path:<\/span>/)
  assert.match(table, /<span class="detail-label">IP Address:<\/span>/)
  assert.match(table, /<span class="detail-label">User Agent:<\/span>/)
  assert.match(table, /<span class="detail-label">Response Body Preview:<\/span>/)
  assert.match(table, /v-if="shouldShowResponseBody\(log\)"/)
  assert.match(table, /log\.status_code === 200/)
  assert.match(table, /Number\(log\.input_tokens \|\| 0\) === 0/)
  assert.match(table, /Number\(log\.output_tokens \|\| 0\) === 0/)
  assert.match(table, /Number\(log\.input_cache_tokens \|\| 0\) === 0/)
  assert.match(table, /isErrorStatus\(log\.status_code\) \|\| isZeroTokenSuccess\(log\)/)
})
