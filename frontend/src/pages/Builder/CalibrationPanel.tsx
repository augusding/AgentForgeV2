import { useState, useEffect } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import {
  Plus, Play, Trash2, CheckCircle2, XCircle, ArrowRight, ArrowLeft,
  Lightbulb, Target, Shield, BarChart3, RefreshCw,
} from 'lucide-react'

interface CaseInput {
  instruction: string
  expected_behavior: string
  expected_output_keywords: string
}

const EMPTY_CASE: CaseInput = { instruction: '', expected_behavior: '', expected_output_keywords: '' }

export default function CalibrationPanel() {
  const {
    calibrating, calibrationReport, runCalibration, triggerFinalize, exporting,
    suggestedCases, loadSuggestedCases, goToPhase, error,
  } = useBuilderStore()

  const [cases, setCases] = useState<CaseInput[]>([{ ...EMPTY_CASE }])

  useEffect(() => {
    loadSuggestedCases()
  }, [])

  const addCase = () => {
    if (cases.length >= 5) return
    setCases([...cases, { ...EMPTY_CASE }])
  }

  const removeCase = (idx: number) => {
    if (cases.length <= 1) return
    setCases(cases.filter((_, i) => i !== idx))
  }

  const updateCase = (idx: number, field: keyof CaseInput, value: string) => {
    setCases(cases.map((c, i) => (i === idx ? { ...c, [field]: value } : c)))
  }

  const applySuggestion = (suggestion: typeof suggestedCases[0]) => {
    const emptyIdx = cases.findIndex(c => !c.instruction.trim())
    if (emptyIdx >= 0) {
      setCases(cases.map((c, i) =>
        i === emptyIdx
          ? {
              instruction: suggestion.instruction,
              expected_behavior: suggestion.expected_behavior,
              expected_output_keywords: suggestion.expected_output_keywords,
            }
          : c,
      ))
    } else if (cases.length < 5) {
      setCases([...cases, {
        instruction: suggestion.instruction,
        expected_behavior: suggestion.expected_behavior,
        expected_output_keywords: suggestion.expected_output_keywords,
      }])
    }
  }

  const handleRun = () => {
    const validCases = cases
      .filter(c => c.instruction.trim())
      .map(c => ({
        instruction: c.instruction.trim(),
        expected_behavior: c.expected_behavior.trim(),
        expected_output_keywords: c.expected_output_keywords
          .split(/[,，]/)
          .map(k => k.trim())
          .filter(Boolean),
      }))

    if (validCases.length === 0) return
    runCalibration(validCases)
  }

  const canRun = cases.some(c => c.instruction.trim()) && !calibrating

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'workflow': return '工作流'
      case 'role': return '角色'
      case 'industry': return '行业'
      default: return ''
    }
  }

  const sourceColor = (source: string) => {
    switch (source) {
      case 'workflow': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'role': return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      case 'industry': return 'bg-green-500/10 text-green-600 border-green-500/20'
      default: return 'bg-surface text-text-muted border-border'
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-success'
    if (score >= 6) return 'text-warning'
    return 'text-danger'
  }

  const scoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-success'
    if (score >= 6) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div>
      {/* Header with explanation */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-text mb-2">场景校准与验收</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            校准是 AI 团队正式上线前的质量验证环节。通过真实业务场景测试 AI 团队的实际表现，
            确保生成的配置能满足您的业务需求。
          </p>
        </div>
        <button
          onClick={() => goToPhase('review')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary border border-border rounded-md hover:bg-surface-hover transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          返回配置预览
        </button>
      </div>

      {/* How it works - collapsible info */}
      {!calibrationReport && (
        <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border">
            <Target size={18} className="text-accent mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text">1. 输入测试场景</h4>
              <p className="text-xs text-text-muted mt-0.5">
                选用推荐用例或自定义真实业务场景，描述任务指令和期望结果
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border">
            <BarChart3 size={18} className="text-accent mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text">2. AI 执行并评分</h4>
              <p className="text-xs text-text-muted mt-0.5">
                AI 用您的配置模拟执行，对比期望与实际结果给出 0-10 分评分
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border">
            <Shield size={18} className="text-accent mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-text">3. 验收确认</h4>
              <p className="text-xs text-text-muted mt-0.5">
                综合评分 &ge; 7.0 为通过。未通过会自动修正后重测，最多 5 轮
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      {/* Suggested cases */}
      {suggestedCases.length > 0 && !calibrationReport && (
        <div className="mb-5 p-4 bg-accent/5 border border-accent/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-accent" />
            <span className="text-sm font-medium text-text">推荐校准用例</span>
            <span className="text-xs text-text-muted">— 基于您的业务信息自动生成，点击填入</span>
          </div>
          <div className="space-y-2">
            {suggestedCases.map((sc, idx) => (
              <button
                key={idx}
                onClick={() => applySuggestion(sc)}
                disabled={calibrating}
                className="w-full text-left p-3 bg-white dark:bg-bg border border-border rounded-md hover:border-accent/40 hover:shadow-sm transition-all group disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text font-medium truncate group-hover:text-accent transition-colors">
                      {sc.instruction}
                    </div>
                    <div className="text-xs text-text-muted mt-1 line-clamp-2">
                      {sc.expected_behavior}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${sourceColor(sc.source)}`}>
                    {sourceLabel(sc.source)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Test cases form */}
      {!calibrationReport && (
        <>
          <div className="space-y-4 mb-6">
            {cases.map((c, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 bg-surface">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text">测试场景 {idx + 1}</span>
                  {cases.length > 1 && (
                    <button onClick={() => removeCase(idx)} className="text-text-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">任务指令</label>
                    <input
                      value={c.instruction}
                      onChange={e => updateCase(idx, 'instruction', e.target.value)}
                      placeholder="描述一个真实的业务任务，如：帮我写一份产品经理的JD并发布"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">期望表现</label>
                    <input
                      value={c.expected_behavior}
                      onChange={e => updateCase(idx, 'expected_behavior', e.target.value)}
                      placeholder="AI 应该如何处理？如：应包含岗位职责、任职要求、薪资范围"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">验收关键词（逗号分隔）</label>
                    <input
                      value={c.expected_output_keywords}
                      onChange={e => updateCase(idx, 'expected_output_keywords', e.target.value)}
                      placeholder="输出中必须包含的关键内容，如：JD, 岗位职责, 面试"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-6">
            {cases.length < 5 && (
              <button
                onClick={addCase}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                <Plus size={14} />
                添加场景
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calibrating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  校准中（AI 正在执行测试并评分）...
                </>
              ) : (
                <>
                  <Play size={14} />
                  开始校准测试
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* ─── Calibration Report (Acceptance Review) ─── */}
      {calibrationReport && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Score header */}
          <div className={`px-5 py-4 ${
            calibrationReport.passed
              ? 'bg-success/10 border-b border-success/20'
              : 'bg-warning/10 border-b border-warning/20'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {calibrationReport.passed
                  ? <CheckCircle2 size={24} className="text-success" />
                  : <XCircle size={24} className="text-warning" />
                }
                <div>
                  <h3 className={`text-base font-semibold ${calibrationReport.passed ? 'text-success' : 'text-warning'}`}>
                    {calibrationReport.passed ? '校准验收通过' : '校准未达标'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {calibrationReport.passed
                      ? '所有测试场景得分 >= 7.0，AI 团队配置质量达标，可以进入定稿部署。'
                      : '部分测试场景得分不足，已自动尝试修正。您可以重新校准或直接定稿。'
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${scoreColor(calibrationReport.overall_score)}`}>
                  {calibrationReport.overall_score.toFixed(1)}
                </div>
                <div className="text-xs text-text-muted">综合评分 /10</div>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-3 w-full bg-white/30 dark:bg-black/20 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${scoreBarColor(calibrationReport.overall_score)}`}
                style={{ width: `${calibrationReport.overall_score * 10}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-text-muted">
              <span>0 不可用</span>
              <span className="text-warning font-medium">7.0 达标线</span>
              <span>10 优秀</span>
            </div>
          </div>

          {/* Detailed results */}
          <div className="p-5 space-y-4">
            {/* Strengths & Weaknesses in two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {calibrationReport.strengths.length > 0 && (
                <div className="p-3 bg-success/5 rounded-lg border border-success/10">
                  <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    达标项
                  </h4>
                  <ul className="text-sm text-text-secondary space-y-1.5">
                    {calibrationReport.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-success shrink-0 mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {calibrationReport.weaknesses.length > 0 && (
                <div className="p-3 bg-warning/5 rounded-lg border border-warning/10">
                  <h4 className="text-xs font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <XCircle size={12} />
                    待改进项
                  </h4>
                  <ul className="text-sm text-text-secondary space-y-1.5">
                    {calibrationReport.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-warning shrink-0 mt-0.5">-</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Recommendation */}
            {calibrationReport.recommendation && (
              <div className="p-3 bg-surface rounded-lg border border-border">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  评估建议
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {calibrationReport.recommendation}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-5 py-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPhase('review')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text"
              >
                <ArrowLeft size={14} />
                返回修改配置
              </button>
              <button
                onClick={() => {
                  // Reset report to allow re-calibration
                  useBuilderStore.setState({ calibrationReport: null })
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text"
              >
                <RefreshCw size={14} />
                重新校准
              </button>
            </div>
            <button
              onClick={triggerFinalize}
              disabled={exporting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {calibrationReport.passed ? '确认验收，定稿导出' : '跳过验收，直接定稿'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
