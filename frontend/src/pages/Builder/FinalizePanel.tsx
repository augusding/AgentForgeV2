import { useBuilderStore } from '../../stores/useBuilderStore'
import { Download, Rocket, CheckCircle2, FileCode, Package, AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react'
import { exportProfileZip } from '../../api/builder'

export default function FinalizePanel() {
  const { session, exportSummary, deployed, triggerDeploy, exporting, error, goToPhase } = useBuilderStore()

  const handleDownloadZip = async () => {
    if (!session) return
    try {
      const blob = await exportProfileZip(session.session_id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `profile-${session.session_id}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // toast handled by client interceptor
    }
  }

  return (
    <div>
      {/* Status banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-lg mb-6 ${
        deployed
          ? 'bg-success/10 border border-success/20'
          : 'bg-accent/10 border border-accent/20'
      }`}>
        <CheckCircle2 size={24} className={deployed ? 'text-success' : 'text-accent'} />
        <div>
          <h3 className={`text-sm font-semibold ${deployed ? 'text-success' : 'text-accent'}`}>
            {deployed ? 'Profile 已部署' : 'Profile 已定稿'}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {deployed
              ? 'AI 团队配置已部署到运行引擎，前往「团队」页面查看。'
              : '配置文件已导出，可以下载或部署到运行引擎。'}
          </p>
        </div>
        {deployed && (
          <a
            href="/team"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent border border-accent/30 rounded-md hover:bg-accent/10 transition-colors"
          >
            查看团队
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-danger mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-danger font-medium">部署遇到问题</p>
            <p className="text-xs text-danger/80 mt-1 break-all">{error}</p>
          </div>
        </div>
      )}

      {/* Export summary */}
      {exportSummary && (
        <div className="border border-border rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-border bg-surface flex items-center gap-2">
            <Package size={16} className="text-accent" />
            <span className="text-sm font-medium text-text">导出清单</span>
            <span className="text-xs text-text-muted ml-auto">
              {exportSummary.file_count} 文件 / {(exportSummary.total_size / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {exportSummary.files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                <FileCode size={14} className="text-text-muted shrink-0" />
                <span className="text-text-secondary truncate">{f.path}</span>
                <span className="text-xs text-text-muted ml-auto">{f.size} B</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => goToPhase('calibration')}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft size={14} />
          返回校准
        </button>

        <button
          onClick={handleDownloadZip}
          className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm text-text hover:bg-surface-hover transition-colors"
        >
          <Download size={16} />
          下载 ZIP
        </button>

        {!deployed && (
          <button
            onClick={triggerDeploy}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                部署中...
              </>
            ) : (
              <>
                <Rocket size={16} />
                部署到 ForgeEngine
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
