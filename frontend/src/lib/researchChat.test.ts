import { describe, it, expect } from 'vitest'
import { groupConversations, deriveTitle, shortChatTitle } from './researchChat'
import type { ResearchConversation } from '../types/researchChat'

const convo = (id: string, updated_at: string): ResearchConversation => ({
  id, title: id, created_at: updated_at, updated_at,
})

describe('groupConversations', () => {
  const now = new Date(2026, 9, 29, 15, 0) // 29 Oct 2026, local time

  it('buckets by calendar day and drops empty groups', () => {
    const groups = groupConversations([
      convo('a', new Date(2026, 9, 29, 9, 0).toISOString()),
      convo('b', new Date(2026, 9, 28, 23, 0).toISOString()),
      convo('c', new Date(2026, 9, 25, 12, 0).toISOString()),
      convo('d', new Date(2026, 8, 1, 12, 0).toISOString()),
    ], now)
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['a']],
      ['Yesterday', ['b']],
      ['Previous 7 days', ['c']],
      ['Earlier', ['d']],
    ])
  })

  it('returns no groups for no conversations', () => {
    expect(groupConversations([], now)).toEqual([])
  })
})

describe('deriveTitle', () => {
  it('collapses whitespace and keeps short titles intact', () => {
    expect(deriveTitle('  key  risks\nin metals ')).toBe('key risks in metals')
  })

  it('truncates long titles with an ellipsis within the limit', () => {
    const t = deriveTitle('x'.repeat(100), 20)
    expect(t).toHaveLength(20)
    expect(t.endsWith('…')).toBe(true)
  })
})

describe('shortChatTitle', () => {
  it('drops the question wording and keeps the subject', () => {
    expect(shortChatTitle('how much is the Commercial refrigeration valued at?')).toBe('Commercial refrigeration valued');
    expect(shortChatTitle('What is the outlook for Consumer Discretionary across our reports?')).toBe('Outlook for Consumer Discretionary');
  });
  it('leaves a short title alone', () => {
    expect(shortChatTitle('Commercial')).toBe('Commercial');
  });
  it('caps long titles at five words', () => {
    expect(shortChatTitle('Compare the views on BLUESTARCO and VOLTAS for the summer season')).toBe('Compare views on BLUESTARCO');
  });
});
