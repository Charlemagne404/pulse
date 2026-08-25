import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCsvDocument, buildPdfSummaryDocument } from './export.js'

test('CSV export escapes values without changing report structure', () => {
  const document = buildCsvDocument(['Section', 'Label', 'Value'], [
    ['Pages', 'A page, with punctuation', '10'],
    ['Pages', 'A "quoted" page', '20'],
  ]).toString('utf8')

  assert.equal(document, 'Section,Label,Value\nPages,"A page, with punctuation",10\nPages,"A ""quoted"" page",20\n')
})

test('PDF summary export produces a self-contained PDF document', () => {
  const document = buildPdfSummaryDocument('Pulse summary', [
    { title: 'Metrics', rows: [{ label: 'Page views', value: 42 }] },
  ]).toString('latin1')

  assert.match(document, /^%PDF-1\.4/)
  assert.match(document, /Pulse summary/)
  assert.match(document, /%%EOF\s*$/)
})
