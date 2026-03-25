import { useEffect } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import PageHeader from '../../components/PageHeader'
import IntakeChat from './IntakeChat'
import ProfilePreview from './ProfilePreview'
import CalibrationPanel from './CalibrationPanel'
import FinalizePanel from './FinalizePanel'
import StepIndicator from './StepIndicator'
import { RotateCcw } from 'lucide-react'

export default function Builder() {
  const { session, loading, error, reset, initSession } = useBuilderStore()

  // Auto-start or restore session
  useEffect(() => {
    if (!session && !loading) {
      initSession()
    }
  }, [session, loading])

  const phase = session?.phase || null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Profile Builder"
        description="通过对话采集业务信息，AI 自动生成团队配置"
        actions={
          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary border border-border rounded-md hover:bg-surface-hover transition-colors"
              >
                <RotateCcw size={14} />
                重新开始
              </button>
            )}
          </div>
        }
      />

      {/* Step indicator */}
      {session && <StepIndicator phase={session.phase} />}

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !session && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-text-secondary">正在创建会话...</span>
        </div>
      )}

      {/* Phase: Intake */}
      {session && (phase === 'intake' || phase === 'generation') && (
        <IntakeChat />
      )}

      {/* Phase: Review */}
      {session && phase === 'review' && (
        <ProfilePreview />
      )}

      {/* Phase: Calibration */}
      {session && phase === 'calibration' && (
        <CalibrationPanel />
      )}

      {/* Phase: Finalized / Deployed */}
      {session && (phase === 'finalized' || phase === 'deployed') && (
        <FinalizePanel />
      )}
    </div>
  )
}
