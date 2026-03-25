import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * P1 Task 8: React 错误边界
 *
 * 捕获子组件的渲染错误，防止整个应用崩溃白屏。
 * 显示友好的 Fallback UI + 重试/刷新按钮。
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[300px] p-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning/10">
              <AlertTriangle size={28} className="text-warning" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-text mb-1">
                页面出现异常
              </h2>
              <p className="text-sm text-text-secondary">
                当前页面遇到了一个意外错误，请尝试重试或刷新页面。
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw size={14} />
                重试
              </button>
              <button
                onClick={this.handleRefresh}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-border text-text-secondary rounded-lg hover:bg-surface-hover transition-colors"
              >
                刷新页面
              </button>
            </div>

            {/* Dev mode: show error details */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                  错误详情 (开发模式)
                </summary>
                <pre className="mt-2 p-3 bg-bg border border-border rounded-lg text-xs text-text-muted overflow-auto max-h-40">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
