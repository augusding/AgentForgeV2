import { useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import toast from 'react-hot-toast'

export default function GuardrailSettings() {
  const config = useConfigStore(s => s.config)
  const patchConfig = useConfigStore(s => s.patchConfig)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // ── Controlled form state ──
  const [budgetLimit, setBudgetLimit] = useState(0)
  const [warningThreshold, setWarningThreshold] = useState(0)
  const [sensitiveWords, setSensitiveWords] = useState<string[]>([])
  const [piiEnabled, setPiiEnabled] = useState(false)
  const [sensitiveInput, setSensitiveInput] = useState('')
  const [initialized, setInitialized] = useState(false)

  if (!config) return null

  if (!initialized) {
    const gr = config.guardrails
    setBudgetLimit(gr.budget_limit_daily)
    setWarningThreshold(gr.budget_warning_threshold * 100)
    setSensitiveWords([...gr.sensitive_words])
    setPiiEnabled(gr.pii_masking_enabled)
    setInitialized(true)
  }

  const addSensitiveWord = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const val = sensitiveInput.trim()
    if (!val || sensitiveWords.includes(val)) return
    setSensitiveWords(prev => [...prev, val])
    setSensitiveInput('')
  }

  const removeSensitiveWord = (w: string) => {
    setSensitiveWords(prev => prev.filter(k => k !== w))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await patchConfig({
        guardrails: {
          budget_limit_daily: budgetLimit,
          budget_warning_threshold: warningThreshold / 100,
          sensitive_words: sensitiveWords,
          pii_masking_enabled: piiEnabled,
        },
      })
      setSaveStatus('saved')
      toast.success('护栏配置已保存并生效')
      setTimeout(() => setSaveStatus('idle'), 10000)
    } catch {
      setSaveStatus('error')
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Budget */}
      <div>
        <h3 className="text-base font-semibold text-text mb-1">预算控制</h3>
        <p className="text-sm text-text-muted mb-4">设置每日 Token 消耗预算上限</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">每日预算上限 ($)</label>
            <input
              type="number"
              value={budgetLimit}
              onChange={e => setBudgetLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text bg-bg focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">预警阈值</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={warningThreshold}
                onChange={e => setWarningThreshold(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text bg-bg focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <span className="text-sm text-text-muted shrink-0">%</span>
            </div>
            <p className="text-xs text-text-muted mt-1">达到预算的此比例时发出警告</p>
          </div>
        </div>
      </div>

      {/* Sensitive words */}
      <div>
        <h3 className="text-base font-semibold text-text mb-1">敏感词过滤</h3>
        <p className="text-sm text-text-muted mb-4">AI 输出包含敏感词时，自动追加安全提醒</p>
        {sensitiveWords.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {sensitiveWords.map(w => (
              <span key={w} className="inline-flex items-center gap-1 px-3 py-1 bg-danger/10 text-danger text-xs font-medium rounded-full">
                {w}
                <button onClick={() => removeSensitiveWord(w)} className="hover:text-danger ml-1">&times;</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted italic mb-3">暂未配置敏感词（将使用默认敏感词库）</p>
        )}
        <input
          value={sensitiveInput}
          onChange={e => setSensitiveInput(e.target.value)}
          onKeyDown={addSensitiveWord}
          placeholder="输入敏感词后回车添加..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text bg-bg focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {/* PII masking */}
      <div className="flex items-center justify-between bg-bg rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-medium text-text">PII 脱敏</div>
          <div className="text-xs text-text-muted">自动识别并脱敏个人身份信息（手机号、身份证号等）</div>
        </div>
        <div
          onClick={() => setPiiEnabled(!piiEnabled)}
          className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${piiEnabled ? 'bg-accent' : 'bg-border'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${piiEnabled ? 'left-5' : 'left-1'}`} />
        </div>
      </div>

      {/* Risk grading info */}
      <div>
        <h3 className="text-base font-semibold text-text mb-1">操作风险分级</h3>
        <p className="text-sm text-text-muted mb-4">系统自动对工具调用进行风险评估（只读）</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-500/5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-text-muted">Level 0-1 安全:</span>
            <span className="text-text">知识检索、计算器、只读命令 — 直接执行</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yellow-500/5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-text-muted">Level 2 中等:</span>
            <span className="text-text">HTTP 请求、文件操作、代码执行 — 记录日志</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/5">
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            <span className="text-text-muted">Level 3 高风险:</span>
            <span className="text-text">删除操作、外部通知、数据发布 — 记录 + 告警</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-text-muted">Level 4 禁止:</span>
            <span className="text-text">rm -rf、代码注入、格式化磁盘 — 直接拦截</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          保存配置
        </button>
        {saveStatus === 'saved' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check size={12} />
            已生效
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <X size={12} />
            保存失败
          </span>
        )}
      </div>
    </div>
  )
}
