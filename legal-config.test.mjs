import test from 'node:test'
import assert from 'node:assert/strict'
import { legalConfig } from './src/legalConfig.ts'

test('public operator configuration uses the designated c/o mailing address', () => {
  assert.equal(legalConfig.operator, 'Heinz Danner')
  assert.deepEqual(legalConfig.address.split('\n'), [
    'c/o Online-Impressum 12951',
    'Europaring 90',
    '53757 Sankt Augustin',
  ])
  assert.equal(legalConfig.email, 'heinz.danner.dev@gmx.net')
})
