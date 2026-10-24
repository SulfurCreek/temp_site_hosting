import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode | ((err: Error) => ReactNode)
  children: ReactNode
  onError?: (e: Error) => void
}

export class ErrorBoundary extends Component<Props, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  componentDidCatch(err: Error) {
    console.warn('[ErrorBoundary]', err.message)
    this.props.onError?.(err)
  }
  render() {
    const { err } = this.state
    if (!err) return this.props.children
    const f = this.props.fallback
    return typeof f === 'function' ? f(err) : f
  }
}
