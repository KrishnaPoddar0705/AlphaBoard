import { Loading } from '../shared/Skeleton'

function Bar({ className = '', width }: { className?: string; width?: number }) {
  return (
    <span aria-hidden style={width ? { width } : undefined}
      className={`block animate-pulse rounded bg-(--mx-sunken) motion-reduce:animate-none ${className}`} />
  )
}

/** The grid's frame with bone rows in Matrix tokens, so nothing jumps when the data lands. */
export default function MatrixSkeleton() {
  return (
    <Loading label="Loading the matrix">
      <div className="flex h-9 items-center gap-6 border-b border-(--mx-line) bg-(--mx-sunken) px-3">
        {[56, 40, 96, 64, 64, 64].map((w, i) => <Bar key={i} className="h-2.5 bg-(--mx-line)" width={w} />)}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-(--mx-line) px-3 py-3">
          <Bar className="size-7 rounded-(--mx-radius)" />
          <div className="w-44 space-y-1.5">
            <Bar className="h-3 w-32" />
            <Bar className="h-2.5 w-20" />
          </div>
          <Bar className="hidden h-3 w-20 md:block" />
          <div className="hidden w-52 space-y-1.5 md:block"><Bar className="h-3 w-full" /><Bar className="h-3 w-3/4" /></div>
          {Array.from({ length: 4 }, (_, j) => (
            <div key={j} className="hidden w-48 space-y-1.5 lg:block"><Bar className="h-3 w-full" /><Bar className="h-3 w-2/3" /></div>
          ))}
        </div>
      ))}
    </Loading>
  )
}
