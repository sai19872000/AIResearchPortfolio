import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFigureBlock,
  parseStatsBlock,
  remarkEditorialInline,
  sanitizeFigureMarkup,
  splitEditorialBlocks,
} from '../../lib/editorial'

test('splitEditorialBlocks separates markdown, stats, and figure blocks while preserving ordinary code fences', () => {
  const md = [
    'Intro with ==key finding==.',
    '',
    '```stats',
    '60% | ten-step task success | at 95% per step',
    '4 | eval layers | contracts to traces',
    '```',
    '',
    '```figure',
    'title: Ten steps turn 95% step accuracy into 60% task success',
    'dek: Compounding reliability across step count.',
    'source: Formula: 0.95^n.',
    'alt: Line chart falling from 95% at step 1 to 60% at step 10.',
    'width: wide',
    '',
    '<svg class="ed-chart" viewBox="0 0 640 200"><path class="subj-line" d="M0,10 L600,150"/></svg>',
    '```',
    '',
    '````markdown',
    '```figure',
    'title: Example inside a docs code block must stay verbatim',
    '```',
    '````',
  ].join('\n')

  const segs = splitEditorialBlocks(md)
  assert.equal(segs.length, 4)
  assert.equal(segs[0].kind, 'markdown')
  assert.equal(segs[1].kind, 'stats')
  if (segs[1].kind === 'stats') {
    assert.equal(segs[1].items.length, 2)
    assert.deepEqual(segs[1].items[0], {
      value: '60%',
      label: 'ten-step task success',
      context: 'at 95% per step',
    })
  }
  assert.equal(segs[2].kind, 'figure')
  if (segs[2].kind === 'figure') {
    assert.equal(segs[2].figure.wide, true)
    assert.equal(segs[2].figure.error, null)
    assert.match(segs[2].figure.markup || '', /<svg class="ed-chart"/)
  }
  assert.equal(segs[3].kind, 'markdown')
  if (segs[3].kind === 'markdown') {
    assert.match(segs[3].text, /Example inside a docs code block/)
  }
})

test('sanitizeFigureMarkup accepts inert SVG + local #id patterns and refuses active/external markup', () => {
  const good = `<svg class="ed-chart" viewBox="0 0 640 120"><defs><pattern id="h" width="5" height="5"><line x1="0" y1="0" x2="0" y2="5"/></pattern></defs><rect class="subj" x="0" y="10" width="200" height="20" fill="url(#h)"/><use href="#h"/></svg>`
  assert.equal(sanitizeFigureMarkup(good).ok, true)

  const badCases = [
    '<svg><script>alert(1)</script></svg>',
    '<svg><rect onload="alert(1)" width="10" height="10"/></svg>',
    '<svg><foreignObject><div>hi</div></foreignObject></svg>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg><use href="https://evil.example/x.svg#a"/></svg>',
    '<img src="https://evil.example/pixel.png" />',
    '<svg><rect style="fill:url(https://evil.example/a)" width="10" height="10"/></svg>',
    '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><style>@import url(https://evil.example/a.css);</style></svg>',
  ]
  for (const bad of badCases) {
    const res = sanitizeFigureMarkup(bad)
    assert.equal(res.ok, false, `should refuse: ${bad}`)
  }
})

test('parseFigureBlock requires an alt line', () => {
  const noAlt = parseFigureBlock('title: Claim\n\n<svg class="ed-chart" viewBox="0 0 100 50"><rect class="subj" width="50" height="20"/></svg>')
  assert.equal(noAlt.markup, null)
  assert.match(noAlt.error || '', /alt/i)
})

test('parseStatsBlock skips blank lines and handles missing context', () => {
  const items = parseStatsBlock('\n95% | per-step accuracy\n\n60% | ten-step task | 0.95^10\n')
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { value: '95%', label: 'per-step accuracy', context: '' })
  assert.deepEqual(items[1], { value: '60%', label: 'ten-step task', context: '0.95^10' })
})

test('remarkEditorialInline transforms ==mark==, safe <sup>/<sub>, and numeric table cells while skipping inlineCode', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Rate drops to ==60% at ten steps== via 0.95' },
          { type: 'html', value: '<sup>' },
          { type: 'text', value: '10' },
          { type: 'html', value: '</sup>' },
          { type: 'text', value: '.' },
          { type: 'inlineCode', value: '==not-highlighted== <sup>raw</sup>' },
        ],
      },
      {
        type: 'tableCell',
        children: [{ type: 'text', value: '71%' }],
      },
      {
        type: 'tableCell',
        children: [{ type: 'text', value: 'Tablets' }],
      },
    ],
  }
  remarkEditorialInline()(tree)
  const pChildren = tree.children[0].children as Array<{ type: string; value?: string; data?: { hName?: string } }>
  assert.ok(pChildren.some((n) => n.data?.hName === 'mark'))
  assert.ok(pChildren.some((n) => n.data?.hName === 'sup'))
  assert.equal(pChildren[pChildren.length - 1].type, 'inlineCode')
  assert.equal(pChildren[pChildren.length - 1].value, '==not-highlighted== <sup>raw</sup>')
  assert.deepEqual((tree.children[1] as { data?: { hProperties?: { className?: string[] } } }).data?.hProperties?.className, ['num'])
  assert.equal((tree.children[2] as { data?: unknown }).data, undefined)
})
