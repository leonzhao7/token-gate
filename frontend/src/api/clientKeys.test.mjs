import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = resolve(__dirname, 'clientKeys.ts')

async function loadModule(apiClient) {
  const original = readFileSync(source, 'utf8')
  const rewritten = original.replace("import apiClient from './client'\n", 'const apiClient = globalThis.__clientKeysApiMock\n')
  const transpiled = ts.transpileModule(rewritten, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  })

  globalThis.__clientKeysApiMock = apiClient
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}#${Date.now()}`)
  } finally {
    delete globalThis.__clientKeysApiMock
  }
}

test('clientKeysApi.create unwraps wrapped client payloads', async () => {
  const createdClient = {
    id: 7,
    name: 'disabled-key',
    token: 'tg-secret',
    enabled: false,
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T00:00:00Z',
  }
  const { clientKeysApi } = await loadModule({
    post: async () => ({
      data: {
        client: createdClient,
        issued_token: 'tg-secret',
      },
    }),
  })

  const result = await clientKeysApi.create({ name: 'disabled-key', enabled: false })

  assert.deepEqual(result, createdClient)
})

test('clientKeysApi.update unwraps wrapped client payloads', async () => {
  const updatedClient = {
    id: 7,
    name: 'disabled-key',
    token: 'tg-secret',
    enabled: false,
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T01:00:00Z',
  }
  const { clientKeysApi } = await loadModule({
    put: async () => ({
      data: {
        client: updatedClient,
        issued_token: '',
      },
    }),
  })

  const result = await clientKeysApi.update(7, { enabled: false })

  assert.deepEqual(result, updatedClient)
})
