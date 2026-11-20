import TerminalPanel from './TerminalPanel'
import { Bone, Loading } from '../shared/Skeleton'

/** The card strip and the open brief, in bones. Shared by the panel and the home skeleton. */
export function BriefsBody() {
  return (
    <Loading label="Loading briefs">
      <div className="flex gap-2 overflow-hidden px-3 py-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex h-[112px] w-[220px] shrink-0 flex-col gap-2 rounded-md border border-[#D7D0C2] px-3 py-2">
            <Bone className="h-2.5 w-28" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-4/5" />
            <Bone className="mt-auto h-2.5 w-32" />
            <Bone className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#D7D0C2] px-3 py-3">
        <div className="flex flex-col gap-1.5">
          <Bone className="h-2.5 w-72 max-w-full" />
          <Bone className="h-4 w-[28rem] max-w-full" />
        </div>
        <Bone className="h-9 w-full rounded-full" />
        <div className="flex flex-col gap-2">
          {['w-full', 'w-11/12', 'w-full', 'w-10/12', 'w-9/12'].map((w, i) => <Bone key={i} className={`h-3 ${w}`} />)}
        </div>
      </div>
    </Loading>
  )
}

/** The whole panel while the home screen is still loading (admins only). */
export default function BriefsSkeleton() {
  return (
    <TerminalPanel code="BRF" title="Briefs">
      <BriefsBody />
    </TerminalPanel>
  )
}
