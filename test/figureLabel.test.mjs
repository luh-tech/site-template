import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figureLabel } from '../src/lib/figureLabel.ts';
import { paperSections } from '../src/lib/paperLanding.ts';

test('a figure renders its label; a record with only the deprecated unit renders the unit', () => {
  assert.equal(figureLabel({ label: 'median RFI response time', unit: 'days' }), 'median RFI response time');
  assert.equal(figureLabel({ unit: 'days' }), 'days');
  assert.equal(figureLabel({}), undefined);
});

test('a paper figure carries its label and measure onto the proof section', () => {
  const measure = { value: '9.7', uom: 'DAY' };
  const [, figures] = paperSections({
    title: 't', summary: 'one', status: 'published',
    figures: [{ figureId: 'f', value: '9.7 days', label: 'median RFI response time', measure, provenance: { sourceRef: 's', public: true } }],
    openFigureIds: ['f'],
  }, 'p');
  assert.deepEqual(figures.figures[0], { figureId: 'f', value: '9.7 days', label: 'median RFI response time', measure, provenance: { sourceRef: 's', public: true } });
});
