import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = resolve(__dirname, 'dashboardStats.ts')

const localHourISO = (value) => {
  const date = new Date(value)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

const localDayISO = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

const addLocalDaysISO = (value, days) => {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

async function loadModule() {
  const transpiled = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`)
}

test('aggregates backend hourly model stats into dashboard totals', async () => {
  const { buildDashboardStats } = await loadModule()

  const stats = buildDashboardStats(
    [
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4o',
        hour: '2026-06-26T07:00:00Z',
        requests: 3,
        successes: 2,
        failures: 1,
        input_tokens: 100,
        output_tokens: 40,
        input_cache_tokens: 20,
        success_avg_duration_ms: 150,
        success_request_bytes: 1000,
        success_response_bytes: 2000,
      },
      {
        backend_id: 2,
        backend: 'beta',
        model: 'gpt-4o',
        hour: '2026-06-26T08:00:00Z',
        requests: 1,
        successes: 1,
        failures: 0,
        input_tokens: 50,
        output_tokens: 10,
        input_cache_tokens: 0,
        success_avg_duration_ms: 90,
        success_request_bytes: 300,
        success_response_bytes: 700,
      },
    ],
    {
      startHour: '2026-06-26T07:00:00Z',
      endHour: '2026-06-26T08:00:00Z',
    },
  )

  assert.equal(stats.summary.requests, 4)
  assert.equal(stats.summary.successes, 3)
  assert.equal(stats.summary.failures, 1)
  assert.equal(stats.summary.failureRate, 0.25)
  assert.equal(stats.summary.successAvgDurationMs, 130)
  assert.equal(stats.summary.inputTokens, 150)
  assert.equal(stats.summary.outputTokens, 50)
  assert.equal(stats.summary.inputCacheTokens, 20)
  assert.equal(stats.summary.totalTokens, 200)
  assert.equal(stats.summary.requestBytes, 1300)
  assert.equal(stats.summary.responseBytes, 2700)
  assert.equal(stats.summary.totalBytes, 4000)
})

test('fills hourly trend gaps and aggregates repeated hours', async () => {
  const { buildDashboardStats } = await loadModule()

  const stats = buildDashboardStats(
    [
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4o',
        hour: '2026-06-26T07:00:00Z',
        requests: 2,
        successes: 1,
        failures: 1,
        input_tokens: 20,
        output_tokens: 5,
        input_cache_tokens: 0,
        success_avg_duration_ms: 80,
        success_request_bytes: 100,
        success_response_bytes: 200,
      },
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4.1',
        hour: '2026-06-26T09:00:00Z',
        requests: 4,
        successes: 4,
        failures: 0,
        input_tokens: 60,
        output_tokens: 40,
        input_cache_tokens: 10,
        success_avg_duration_ms: 140,
        success_request_bytes: 500,
        success_response_bytes: 900,
      },
    ],
    {
      startHour: '2026-06-26T07:00:00Z',
      endHour: '2026-06-26T09:00:00Z',
    },
  )

  assert.deepEqual(
    stats.hourlySeries.map((point) => ({
      hour: point.hour,
      requests: point.requests,
      failures: point.failures,
      totalTokens: point.totalTokens,
      totalBytes: point.totalBytes,
    })),
    [
      {
        hour: '2026-06-26T07:00:00.000Z',
        requests: 2,
        failures: 1,
        totalTokens: 25,
        totalBytes: 300,
      },
      {
        hour: '2026-06-26T08:00:00.000Z',
        requests: 0,
        failures: 0,
        totalTokens: 0,
        totalBytes: 0,
      },
      {
        hour: '2026-06-26T09:00:00.000Z',
        requests: 4,
        failures: 0,
        totalTokens: 100,
        totalBytes: 1400,
      },
    ],
  )
})

test('builds backend and model rankings with weighted success latency', async () => {
  const { buildDashboardStats } = await loadModule()

  const stats = buildDashboardStats([
    {
      backend_id: 1,
      backend: 'alpha',
      model: 'gpt-4o',
      hour: '2026-06-26T07:00:00Z',
      requests: 2,
      successes: 2,
      failures: 0,
      input_tokens: 100,
      output_tokens: 50,
      input_cache_tokens: 0,
      success_avg_duration_ms: 100,
      success_request_bytes: 100,
      success_response_bytes: 200,
    },
    {
      backend_id: 1,
      backend: 'alpha',
      model: 'gpt-4.1',
      hour: '2026-06-26T08:00:00Z',
      requests: 3,
      successes: 1,
      failures: 2,
      input_tokens: 40,
      output_tokens: 10,
      input_cache_tokens: 5,
      success_avg_duration_ms: 400,
      success_request_bytes: 300,
      success_response_bytes: 700,
    },
    {
      backend_id: 2,
      backend: 'beta',
      model: 'gpt-4o',
      hour: '2026-06-26T08:00:00Z',
      requests: 6,
      successes: 6,
      failures: 0,
      input_tokens: 60,
      output_tokens: 20,
      input_cache_tokens: 0,
      success_avg_duration_ms: 50,
      success_request_bytes: 600,
      success_response_bytes: 1200,
    },
  ])

  assert.deepEqual(
    stats.backendRows.map((row) => ({
      backend: row.backend,
      requests: row.requests,
      failureRate: row.failureRate,
      successAvgDurationMs: row.successAvgDurationMs,
    })),
    [
      { backend: 'beta', requests: 6, failureRate: 0, successAvgDurationMs: 50 },
      { backend: 'alpha', requests: 5, failureRate: 0.4, successAvgDurationMs: 200 },
    ],
  )

  assert.deepEqual(
    stats.modelRows.map((row) => ({
      model: row.model,
      requests: row.requests,
      failureRate: row.failureRate,
      successAvgDurationMs: row.successAvgDurationMs,
    })),
    [
      { model: 'gpt-4o', requests: 8, failureRate: 0, successAvgDurationMs: 62.5 },
      { model: 'gpt-4.1', requests: 3, failureRate: 0.6667, successAvgDurationMs: 400 },
    ],
  )
})

test('builds inclusive UTC hour ranges for backend stats queries', async () => {
  const { buildStatsRange } = await loadModule()

  assert.deepEqual(
    buildStatsRange(6, new Date('2026-06-26T09:45:00Z')),
    {
      startHour: '2026-06-26T04:00:00.000Z',
      endHour: '2026-06-26T09:00:00.000Z',
    },
  )

  assert.deepEqual(
    buildStatsRange(1, new Date('2026-06-26T09:45:00Z')),
    {
      startHour: '2026-06-26T09:00:00.000Z',
      endHour: '2026-06-26T09:00:00.000Z',
    },
  )
})

test('builds preset ranges for today and seven days', async () => {
  const { buildStatsPresetRange } = await loadModule()

  assert.deepEqual(
    buildStatsPresetRange('today', new Date('2026-06-26T09:45:00Z')),
    {
      startHour: localDayISO('2026-06-26T09:45:00Z'),
      endHour: localHourISO('2026-06-26T09:45:00Z'),
      bucket: 'hour',
    },
  )

  assert.deepEqual(
    buildStatsPresetRange('7d', new Date('2026-06-26T09:45:00Z')),
    {
      startHour: addLocalDaysISO(localDayISO('2026-06-26T09:45:00Z'), -6),
      endHour: localHourISO('2026-06-26T09:45:00Z'),
      bucket: 'day',
    },
  )
})

test('groups trend data by day when daily bucket is selected', async () => {
  const { buildDashboardStats } = await loadModule()

  const stats = buildDashboardStats(
    [
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4o',
        hour: '2026-06-24T07:00:00Z',
        requests: 2,
        successes: 2,
        failures: 0,
        input_tokens: 10,
        output_tokens: 5,
        input_cache_tokens: 0,
        success_avg_duration_ms: 100,
        success_request_bytes: 100,
        success_response_bytes: 200,
      },
      {
        backend_id: 2,
        backend: 'beta',
        model: 'gpt-4.1',
        hour: '2026-06-24T08:00:00Z',
        requests: 3,
        successes: 1,
        failures: 2,
        input_tokens: 30,
        output_tokens: 10,
        input_cache_tokens: 0,
        success_avg_duration_ms: 200,
        success_request_bytes: 300,
        success_response_bytes: 400,
      },
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4o',
        hour: '2026-06-26T03:00:00Z',
        requests: 4,
        successes: 4,
        failures: 0,
        input_tokens: 40,
        output_tokens: 20,
        input_cache_tokens: 10,
        success_avg_duration_ms: 120,
        success_request_bytes: 500,
        success_response_bytes: 600,
      },
    ],
    {
      startHour: '2026-06-24T00:00:00Z',
      endHour: '2026-06-26T09:00:00Z',
      bucket: 'day',
    },
  )

  assert.deepEqual(
    stats.hourlySeries.map((point) => ({
      hour: point.hour,
      requests: point.requests,
      failures: point.failures,
    })),
    [
      { hour: localDayISO('2026-06-24T07:00:00Z'), requests: 5, failures: 2 },
      { hour: addLocalDaysISO(localDayISO('2026-06-24T07:00:00Z'), 1), requests: 0, failures: 0 },
      { hour: localDayISO('2026-06-26T03:00:00Z'), requests: 4, failures: 0 },
    ],
  )

  assert.deepEqual(
    stats.backendHourlySeries[0].segments.map((segment) => ({
      key: segment.key,
      value: segment.value,
    })),
    [
      { key: '2', value: 3 },
      { key: '1', value: 2 },
    ],
  )
})

test('builds stacked backend and model hourly trends', async () => {
  const { buildDashboardStats } = await loadModule()

  const stats = buildDashboardStats(
    [
      {
        backend_id: 1,
        backend: 'alpha',
        model: 'gpt-4o',
        hour: '2026-06-26T07:00:00Z',
        requests: 2,
        successes: 2,
        failures: 0,
        input_tokens: 10,
        output_tokens: 5,
        input_cache_tokens: 0,
        success_avg_duration_ms: 100,
        success_request_bytes: 100,
        success_response_bytes: 200,
      },
      {
        backend_id: 2,
        backend: 'beta',
        model: 'gpt-4o',
        hour: '2026-06-26T07:00:00Z',
        requests: 3,
        successes: 1,
        failures: 2,
        input_tokens: 30,
        output_tokens: 10,
        input_cache_tokens: 0,
        success_avg_duration_ms: 200,
        success_request_bytes: 300,
        success_response_bytes: 400,
      },
      {
        backend_id: 2,
        backend: 'beta',
        model: 'claude-3-5-sonnet',
        hour: '2026-06-26T08:00:00Z',
        requests: 4,
        successes: 4,
        failures: 0,
        input_tokens: 40,
        output_tokens: 20,
        input_cache_tokens: 10,
        success_avg_duration_ms: 120,
        success_request_bytes: 500,
        success_response_bytes: 600,
      },
    ],
    {
      startHour: '2026-06-26T07:00:00Z',
      endHour: '2026-06-26T08:00:00Z',
    },
  )

  assert.deepEqual(
    stats.backendHourlySeries.map((point) => ({
      hour: point.hour,
      total: point.total,
      segments: point.segments.map((segment) => ({
        key: segment.key,
        label: segment.label,
        value: segment.value,
      })),
    })),
    [
      {
        hour: '2026-06-26T07:00:00.000Z',
        total: 5,
        segments: [
          { key: '2', label: 'beta', value: 3 },
          { key: '1', label: 'alpha', value: 2 },
        ],
      },
      {
        hour: '2026-06-26T08:00:00.000Z',
        total: 4,
        segments: [
          { key: '2', label: 'beta', value: 4 },
        ],
      },
    ],
  )

  assert.deepEqual(
    stats.modelHourlySeries.map((point) => ({
      hour: point.hour,
      total: point.total,
      segments: point.segments.map((segment) => ({
        key: segment.key,
        label: segment.label,
        value: segment.value,
      })),
    })),
    [
      {
        hour: '2026-06-26T07:00:00.000Z',
        total: 5,
        segments: [
          { key: 'gpt-4o', label: 'gpt-4o', value: 5 },
        ],
      },
      {
        hour: '2026-06-26T08:00:00.000Z',
        total: 4,
        segments: [
          { key: 'claude-3-5-sonnet', label: 'claude-3-5-sonnet', value: 4 },
        ],
      },
    ],
  )
})
