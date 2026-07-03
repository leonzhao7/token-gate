import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('backend form exposes new-api type and editable console cookie fields', () => {
  const form = read('components/backends/BackendForm.vue')

  assert.match(form, /v-model="formData\.backend_type"/)
  assert.match(form, /<option value="new-api">new-api<\/option>/)
  assert.match(form, /v-model="formData\.console_cookie"/)
  assert.match(form, /backend_type: 'new-api'/)
  assert.match(form, /console_cookie: ''/)
  assert.match(form, /backend_type: formData\.value\.backend_type/)
  assert.match(form, /console_cookie: formData\.value\.console_cookie\.trim\(\)/)
})

test('backend list exposes only checkin and model plaza manual console buttons', () => {
  const list = read('components/backends/BackendList.vue')

  assert.match(list, /@click="\$emit\('checkin', backend\)"/)
  assert.match(list, />签到</)
  assert.match(list, /@click="\$emit\('pricing', backend\)"/)
  assert.match(list, />模型广场</)
  assert.doesNotMatch(list, /console-login/)
  assert.doesNotMatch(list, /console-self/)
  assert.doesNotMatch(list, /user-models/)
  assert.doesNotMatch(list, /\/api\/models/)
})

test('frontend API and store call the new backend console endpoints', () => {
  const api = read('api/backends.ts')
  const store = read('stores/backends.ts')
  const page = read('pages/Backends.vue')

  assert.match(api, /checkin\(id: number\)/)
  assert.match(api, /`\/backends\/\$\{id\}\/console\/checkin`/)
  assert.match(api, /pricing\(id: number\)/)
  assert.match(api, /`\/backends\/\$\{id\}\/console\/pricing`/)
  assert.match(store, /checkinBackend/)
  assert.match(store, /syncBackendPricing/)
  assert.match(page, /@checkin="handleCheckin"/)
  assert.match(page, /@pricing="handlePricing"/)
})

test('frontend backend types include console state and pricing json fields', () => {
  const types = read('api/types.ts')

  assert.match(types, /backend_type\?: 'new-api'/)
  assert.match(types, /console_cookie\?: string/)
  assert.match(types, /console_account_json\?: string/)
  assert.match(types, /console_pricing_json\?: string/)
})
