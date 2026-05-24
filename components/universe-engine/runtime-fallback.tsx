"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { StaticStarfield } from "./static-starfield"

interface RuntimeFallbackProps {
  children: ReactNode
}

interface RuntimeFallbackState {
  hasError: boolean
}

export class UniverseRuntimeFallback extends Component<RuntimeFallbackProps, RuntimeFallbackState> {
  state: RuntimeFallbackState = { hasError: false }

  static getDerivedStateFromError(): RuntimeFallbackState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Universe engine runtime error", error, errorInfo)
  }

  private reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="relative h-full w-full bg-black">
        <StaticStarfield />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div className="pointer-events-auto rounded-2xl border border-white/20 bg-black/60 p-4 text-center backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/75">Universe paused</p>
            <p className="mt-2 text-sm text-white/85">3D scene failed to initialize on this device.</p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 rounded border border-white/35 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/90 hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
}
