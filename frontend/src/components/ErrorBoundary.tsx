import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(): State { return { hasError: true } }
  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error.message) }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-muted)]">
          <p>页面加载异常</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-sm text-[var(--accent)] hover:underline">重试</button>
        </div>
      )
    }
    return this.props.children
  }
}
