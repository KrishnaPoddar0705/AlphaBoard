import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listBoardTree, getBoard, createBoard, deleteBoard, updateBoard,
  createFolder, renameFolder, deleteFolder, type NewBoard, type BoardPatch,
} from '@/lib/commandCenter/boards'
import type { Board, BoardFolder, BoardSummary } from '@/lib/commandCenter/boardTypes'
import { ccKeys, NO_SESSION_MESSAGE } from './useCoverage'
import { useCommandCenterSession } from './useCommandCenterSession'
import { track } from '@/lib/analytics'

export function useBoardTree() {
  const { ready } = useCommandCenterSession()
  return useQuery({
    queryKey: ccKeys.boardTree(),
    queryFn: listBoardTree,
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useBoard(id: string | null) {
  const { ready } = useCommandCenterSession()
  return useQuery<Board | null>({
    queryKey: ccKeys.boardDoc(id ?? ''),
    queryFn: () => getBoard(id!),
    enabled: ready && !!id,
    // The open document is owned by the editor once loaded; refetching would clobber
    // unsaved keystrokes with the last saved copy.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

function useGuard() {
  const { authenticated } = useCommandCenterSession()
  return <T,>(fn: () => Promise<T>) => {
    if (!authenticated) throw new Error(NO_SESSION_MESSAGE)
    return fn()
  }
}

export function useCreateBoard() {
  const qc = useQueryClient()
  const guard = useGuard()
  return useMutation<Board, Error, NewBoard>({
    mutationFn: (input) => guard(() => createBoard(input)),
    onSuccess: (board) => {
      qc.setQueryData(ccKeys.boardDoc(board.id), board)
      qc.invalidateQueries({ queryKey: ccKeys.boardTree() })
      track('cc_board_created', { coverage_id: board.coverage_id })
    },
    onError: (e) => toast.error(e.message),
  })
}

/** Autosave path: patches the tree row in place instead of refetching the whole tree. */
export function useSaveBoard() {
  const qc = useQueryClient()
  const guard = useGuard()
  return useMutation<BoardSummary, Error, { id: string; patch: BoardPatch }>({
    mutationFn: ({ id, patch }) => guard(() => updateBoard(id, patch)),
    onSuccess: (row, { id, patch }) => {
      qc.setQueryData<{ folders: BoardFolder[]; boards: BoardSummary[] }>(ccKeys.boardTree(), (prev) =>
        prev ? { ...prev, boards: prev.boards.map((b) => (b.id === row.id ? row : b)) } : prev)
      // The open note's cache never refetches (staleTime: Infinity), so keep it in step
      // with what was saved -- otherwise reopening the note shows the body it loaded with.
      qc.setQueryData<Board | null>(ccKeys.boardDoc(id), (prev) =>
        prev ? { ...prev, ...patch, updated_at: row.updated_at } as Board : prev)
    },
  })
}

export function useDeleteBoard() {
  const qc = useQueryClient()
  const guard = useGuard()
  return useMutation<void, Error, string>({
    mutationFn: (id) => guard(() => deleteBoard(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ccKeys.boardTree() }),
    onError: (e) => toast.error(e.message),
  })
}

export function useMoveBoard() {
  const qc = useQueryClient()
  const guard = useGuard()
  return useMutation<BoardSummary, Error, { id: string; folder_id: string | null }>({
    mutationFn: ({ id, folder_id }) => guard(() => updateBoard(id, { folder_id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ccKeys.boardTree() }),
    onError: (e) => toast.error(e.message),
  })
}

export function useFolderMutations() {
  const qc = useQueryClient()
  const guard = useGuard()
  const done = () => qc.invalidateQueries({ queryKey: ccKeys.boardTree() })
  const onError = (e: Error) => toast.error(e.message)
  return {
    create: useMutation<BoardFolder, Error, { coverage_id: string; parent_id?: string | null; name: string }>({
      mutationFn: (input) => guard(() => createFolder(input)), onSuccess: done, onError,
    }),
    rename: useMutation<void, Error, { id: string; name: string }>({
      mutationFn: ({ id, name }) => guard(() => renameFolder(id, name)), onSuccess: done, onError,
    }),
    remove: useMutation<void, Error, string>({
      mutationFn: (id) => guard(() => deleteFolder(id)), onSuccess: done, onError,
    }),
  }
}

/**
 * The viewer's own board behind a log entry, if they wrote it on the Thinking Board.
 * Read from the cached tree, so a timeline of fifty entries costs no extra queries. Boards
 * are author-private by RLS, so this is null for everyone else -- which is right: they
 * could not open the board anyway.
 */
export function usePublishedBoardId(eventId: string | null | undefined): string | null {
  const { data } = useBoardTree()
  if (!eventId || !data) return null
  return data.boards.find((b) => b.published_event_id === eventId)?.id ?? null
}
