import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = resolve(__dirname, 'usageLogParams.ts')

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

test('builds backend usage log query params from page filters', async () => {
  const { buildUsageLogListParams } = await loadModule()
  const params = buildUsageLogListParams(
    {
      time_range: '24h',
      status: 'client_error',
      model: 'gpt-4o',
      client_key: 'beta-client',
      page: 2,
      limit: 25,
    },
    new Date('2026-07-05T12:34:56.000Z')
  )

  assert.equal(params.get('date_from'), '2026-07-04T12:34:56.000Z')
  assert.equal(params.get('date_to'), '2026-07-05T12:34:56.000Z')
  assert.equal(params.get('status'), '4xx')
  assert.equal(params.get('model'), 'gpt-4o')
  assert.equal(params.get('client_key'), 'beta-client')
  assert.equal(params.get('page'), '2')
  assert.equal(params.get('limit'), '25')

  assert.equal(params.has('time_range'), false)
  assert.equal(params.has('status_code'), false)
  assert.equal(params.has('client_key_id'), false)
})

