import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = resolve(__dirname, 'backendPayload.ts')

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

test('formats model mapping objects for editing', async () => {
  const { formatModelMappingForInput } = await loadModule()

  assert.equal(
    formatModelMappingForInput({ 'gpt-4o': 'azure-gpt-4o', 'claude-public': 'claude-3-5-sonnet' }),
    '{\n  "gpt-4o": "azure-gpt-4o",\n  "claude-public": "claude-3-5-sonnet"\n}'
  )
})

test('parses model mapping JSON into the backend API object shape', async () => {
  const { parseModelMappingInput } = await loadModule()

  assert.deepEqual(
    parseModelMappingInput('{"gpt-4o":"azure-gpt-4o","claude-public":"claude-3-5-sonnet"}'),
    { 'gpt-4o': 'azure-gpt-4o', 'claude-public': 'claude-3-5-sonnet' }
  )
  assert.deepEqual(parseModelMappingInput(''), {})
  assert.throws(() => parseModelMappingInput('gpt-4o:azure-gpt-4o'), /valid JSON object/)
})

test('parses comma-separated backend models into the backend API array shape', async () => {
  const { parseModelListInput } = await loadModule()

  assert.deepEqual(parseModelListInput(' gpt-4o, claude-3-5-sonnet, , gpt-image-* '), [
    'gpt-4o',
    'claude-3-5-sonnet',
    'gpt-image-*',
  ])
  assert.deepEqual(parseModelListInput(''), [])
})

test('normalizes proxy id from current and legacy backend payloads', async () => {
  const { normalizeBackendProxyId } = await loadModule()

  assert.equal(normalizeBackendProxyId({ proxy_id: 12 }), 12)
  assert.equal(normalizeBackendProxyId({ proxy_id: 0, socks_proxy_id: 9 }), 9)
  assert.equal(normalizeBackendProxyId({ proxy_id: null, socks_proxy_id: 7 }), 7)
  assert.equal(normalizeBackendProxyId({ proxy: { id: 5 } }), 5)
  assert.equal(normalizeBackendProxyId({}), 0)
})
