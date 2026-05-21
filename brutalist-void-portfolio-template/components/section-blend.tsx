export function SectionBlend() {
  return (
    <div
      aria-hidden="true"
      className="relative h-40 -mt-20 z-10 pointer-events-none"
    >
      <div className="absolute inset-0 h-1/2 bg-linear-to-b from-transparent to-background" />
      <div className="absolute inset-0 top-1/2 h-1/2 bg-linear-to-b from-background to-transparent" />
    </div>
  )
}
