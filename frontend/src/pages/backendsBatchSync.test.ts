import test from 'node:test'
import assert from 'node:assert/strict'

import type { Backend } from '@/api/types'
import type { BackendConsoleRequestLog, BackendConsoleSyncResponse } from '@/api/types'
import {
  canSyncBackendConsole,
  formatBackendConsoleSyncBatchSummary,
  runBackendConsoleSyncBatch
} from './backendsBatchSync.ts'

const createBackend = (id: number, backendType: Backend['backend_type'], name = `backend-${id}`): Backend => ({
  id,
  name,
  base_url: `https://example-${id}.test`,
  api_key: `key-${id}`,
  protocol: 'openai',
  backend_type: backendType,
  weight: 1,
  status: 'normal',
  consecutive_failures: 0,
  model_mapping: {},
  proxy_id: null,
  created_at: '2026-07-06T00:00:00Z',
  updated_at: '2026-07-06T00:00:00Z',
  models: [],
})

const createResponse = (backend: Backend): BackendConsoleSyncResponse => ({
  backend,
  requests: [{
    time: '2026-07-06T00:00:00Z',
    method: 'POST',
    path: `/admin/api/backends/${backend.id}/console/sync`,
    status_code: 200,
    body: '{"ok":true}'
  } satisfies BackendConsoleRequestLog]
})

test('runBackendConsoleSyncBatch syncs only supported backends in order and continues after failure', async () => {
  const generic = createBackend(1, '')
  const first = createBackend(2, 'new-api', 'alpha')
  const failing = createBackend(3, 'sub2api', 'beta')
  const last = createBackend(4, 'new-api', 'gamma')
  const executionOrder: number[] = []
  const started: number[] = []
  const finished: number[] = []
  const failed: number[] = []

  const result = await runBackendConsoleSyncBatch({
    backends: [generic, first, failing, last],
    syncBackend: async (backend) => {
      executionOrder.push(backend.id)
      if (backend.id === failing.id) {
        throw new Error('sync failed')
      }
      return createResponse(backend)
    },
    onBackendStart: (backend) => {
      started.push(backend.id)
    },
    onBackendSuccess: (backend) => {
      finished.push(backend.id)
    },
    onBackendError: (backend) => {
      failed.push(backend.id)
    }
  })

  assert.deepEqual(executionOrder, [2, 3, 4])
  assert.deepEqual(started, [2, 3, 4])
  assert.deepEqual(finished, [2, 4])
  assert.deepEqual(failed, [3])
  assert.equal(result.total, 3)
  assert.equal(result.successCount, 2)
  assert.equal(result.failureCount, 1)
  assert.deepEqual(result.skipped.map((backend) => backend.id), [1])
  assert.deepEqual(result.successes.map((entry) => entry.backend.id), [2, 4])
  assert.deepEqual(result.failures.map((entry) => entry.backend.id), [3])
})

test('canSyncBackendConsole only allows new-api and sub2api backends', () => {
  assert.equal(canSyncBackendConsole(createBackend(10, 'new-api')), true)
  assert.equal(canSyncBackendConsole(createBackend(11, 'sub2api')), true)
  assert.equal(canSyncBackendConsole(createBackend(12, '')), false)
})

test('formatBackendConsoleSyncBatchSummary includes failed backend names', () => {
  const summary = formatBackendConsoleSyncBatchSummary({
    total: 3,
    successCount: 2,
    failureCount: 1,
    skipped: [],
    successes: [
      { backend: createBackend(2, 'new-api', 'alpha'), response: createResponse(createBackend(2, 'new-api', 'alpha')) },
      { backend: createBackend(4, 'new-api', 'gamma'), response: createResponse(createBackend(4, 'new-api', 'gamma')) }
    ],
    failures: [
      { backend: createBackend(3, 'sub2api', 'beta'), error: new Error('sync failed') }
    ]
  })

  assert.match(summary, /已完成 2\/3 个 backend 同步，失败 1 个/)
  assert.match(summary, /beta/)
})
