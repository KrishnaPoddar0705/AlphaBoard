import { supabase } from '@/lib/supabase'
import { describeCcError } from './api'
import type { CommandCenterEvent } from './types'
import type { Board, BoardFolder, BoardSummary, BoardCard, DocNode } from './boardTypes'
import { EMPTY_DOC } from './boardTypes'

/**
 * Thinking Board persistence: straight to Supabase under the caller's JWT, like the
 * rest of Command Center. Drafts are author-only by RLS; organization_id and
 * created_by are derived by trigger and never sent from here.
 */

function boardsError(error: { message: string; code?: string }, what: string): Error {
  if (error.code === 'PGRST205' || /schema cache/i.test(error.message ?? '')) {
    return new Error(
      `${what}: the Thinking Board tables are not in the database yet. Apply ` +
      `database/migration_command_center_thinking_board.sql, then reload.`
    )
  }
  return describeCcError(error, what)
}

const SUMMARY_COLUMNS =
  'id, coverage_id, folder_id, title, published_event_id, last_published_at, updated_at'

export async function listBoardTree(): Promise<{ folders: BoardFolder[]; boards: BoardSummary[] }> {
  const [folders, boards] = await Promise.all([
    supabase.from('cc_board_folders').select('id, coverage_id, parent_id, name, position, created_at')
      .order('position').order('created_at'),
    supabase.from('cc_boards').select(SUMMARY_COLUMNS).order('updated_at', { ascending: false }),
  ])
  if (folders.error) throw boardsError(folders.error, 'Could not load your notes')
  if (boards.error) throw boardsError(boards.error, 'Could not load your notes')
  return { folders: folders.data as BoardFolder[], boards: boards.data as BoardSummary[] }
}

export async function getBoard(id: string): Promise<Board | null> {
  const { data, error } = await supabase.from('cc_boards').select('*').eq('id', id).maybeSingle()
  if (error) throw boardsError(error, 'Could not open this note')
  return data as Board | null
}

export interface NewBoard {
  coverage_id: string
  folder_id?: string | null
  title?: string
  doc?: DocNode
}

export async function createBoard(input: NewBoard): Promise<Board> {
  const { data, error } = await supabase
    .from('cc_boards')
    .insert({
      coverage_id: input.coverage_id,
      folder_id: input.folder_id ?? null,
      title: input.title?.trim() || 'Untitled note',
      doc: input.doc ?? EMPTY_DOC,
    })
    .select()
    .single()
  if (error) throw boardsError(error, 'Could not create a note')
  return data as Board
}

export interface BoardPatch {
  title?: string
  doc?: DocNode
  doc_markdown?: string
  cards?: BoardCard[]
  folder_id?: string | null
  published_event_id?: string | null
  last_published_at?: string | null
}

export async function updateBoard(id: string, patch: BoardPatch): Promise<BoardSummary> {
  const { data, error } = await supabase
    .from('cc_boards').update(patch).eq('id', id).select(SUMMARY_COLUMNS).single()
  if (error) throw boardsError(error, 'Could not save this note')
  return data as BoardSummary
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('cc_boards').delete().eq('id', id)
  if (error) throw boardsError(error, 'Could not delete this note')
}

export async function createFolder(input: {
  coverage_id: string; parent_id?: string | null; name: string
}): Promise<BoardFolder> {
  const { data, error } = await supabase
    .from('cc_board_folders')
    .insert({ coverage_id: input.coverage_id, parent_id: input.parent_id ?? null, name: input.name.trim() })
    .select('id, coverage_id, parent_id, name, position, created_at')
    .single()
  if (error) throw boardsError(error, 'Could not create the folder')
  return data as BoardFolder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('cc_board_folders').update({ name: name.trim() }).eq('id', id)
  if (error) throw boardsError(error, 'Could not rename the folder')
}

/** Notes inside fall back to the stock root (folder_id ON DELETE SET NULL). */
export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('cc_board_folders').delete().eq('id', id)
  if (error) throw boardsError(error, 'Could not delete the folder')
}

export interface PublishedEntry {
  id: string
  kind: CommandCenterEvent['kind']
  subtype: CommandCenterEvent['subtype']
  title: string
  event_date: string
  period_label: string | null
  thesis_impact: CommandCenterEvent['thesis_impact']
  svan_view?: string | null
  svan_rating?: CommandCenterEvent['svan_rating']
}

/** The log entry a board was published as, or null if it has since been deleted. */
export async function getPublishedEntry(eventId: string): Promise<PublishedEntry | null> {
  const { data, error } = await supabase.from('cc_events').select('*').eq('id', eventId).maybeSingle()
  if (error) throw describeCcError(error, 'Could not read the published entry')
  return data as PublishedEntry | null
}
