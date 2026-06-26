import assert from 'node:assert/strict'
import test from 'node:test'

import { formatLatencySeconds } from './latency.ts'

test('formatLatencySeconds formats milliseconds as seconds', () => {
  assert.equal(formatLatencySeconds(82), '0.08s')
  assert.equal(formatLatencySeconds(804), '0.8s')
  assert.equal(formatLatencySeconds(1200), '1.2s')
  assert.equal(formatLatencySeconds(10000), '10s')
})

test('formatLatencySeconds supports custom empty labels', () => {
  assert.equal(formatLatencySeconds(undefined), '0s')
  assert.equal(formatLatencySeconds(null, 'N/A'), 'N/A')
  assert.equal(formatLatencySeconds(0, 'N/A'), 'N/A')
  assert.equal(formatLatencySeconds(1), '0.01s')
})
