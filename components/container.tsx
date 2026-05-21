import type { ReactNode } from "react"

type ContainerProps = {
  children: ReactNode
  className?: string
  width?: "default" | "narrow" | "wide"
}

const widthMap = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
}

/**
 * Centered max-width container.
 * Use on every section so content stays a comfortable reading width on large screens
 * while still going edge-to-edge with padding on mobile.
 */
export function Container({
  children,
  className = "",
  width = "default",
}: ContainerProps) {
  return (
    <div
      className={`relative mx-auto w-full ${widthMap[width]} px-6 md:px-10 ${className}`}
    >
      {children}
    </div>
  )
}
