import { useState, useEffect, useMemo } from 'react'
import { Loader2, Check, X, ChevronDown, Eye, EyeOff, Zap } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import type { ProviderDef, TierConfig } from '../../types/config'
import client from '../../api/client'
import toast from 'react-hot-toast'

const TIER_LABELS: Record<string, { num: string; title: string; desc: string }> = {
  tier1: { num: '1', title: '主模型', desc: '首选模型，必须配置' },
  tier2: { num: '2', title: '备选模型 1', desc: '主模型不可用或预算不足时自动切换' },
  tier3: { num: '3', title: '备选模型 2', desc: '前两级均不可用时自动切换' },
}

interface TierFormState {
  provider: string
  model: string
  api_key_env: string
  enabled: boolean
}

export default function LLMSettings() {
  const config = useConfigStore(s => s.config)
  const patchConfig = useConfigStore(s => s.patchConfig)
  const [saving, setSaving] = useState(false)

  // Form state for all 3 tiers
  const [tiers, setTiers] = useState<Record<string, TierFormState>>({
    tier1: { provider: '', model: '', api_key_env: '', enabled: true },
    tier2: { provider: '', model: '', api_key_env: '', enabled: false },
    tier3: { provider: '', model: '', api_key_env: '', enabled: false },
  })

  // API Key input state (separate — only sent when user enters a new key)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [initialized, setInitialized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Provider registry from backend
  const providers: ProviderDef[] = useMemo(
    () => config?.llm?.providers || [],
    [config?.llm?.providers]
  )

  // Server-side tier data
  const serverTiers = useMemo(
    () => (config?.llm?.tiers || {}) as Record<string, TierConfig>,
    [config?.llm?.tiers]
  )

  // Initialize form from config
  useEffect(() => {
    if (!config || initialized) return
    const newTiers: Record<string, TierFormState> = {
      tier1: { provider: '', model: '', api_key_env: '', enabled: true },
      tier2: { provider: '', model: '', api_key_env: '', enabled: false },
      tier3: { provider: '', model: '', api_key_env: '', enabled: false },
    }
    for (const tierKey of ['tier1', 'tier2', 'tier3']) {
      const s = serverTiers[tierKey]
      if (s) {
        newTiers[tierKey] = {
          provider: s.provider || '',
          model: s.model || '',
          api_key_env: s.api_key_env || '',
          enabled: tierKey === 'tier1' ? true : (s.enabled ?? false),
        }
      }
    }
    setTiers(newTiers)
    setInitialized(true)
  }, [config, initialized, serverTiers])

  if (!config) return null

  // Get models for a specific provider
  const getModelsForProvider = (providerId: string) => {
    const p = providers.find(p => p.id === providerId)
    return p?.models || []
  }

  // Update a tier field
  const updateTier = (tierKey: string, field: keyof TierFormState, value: string | boolean) => {
    setTiers(prev => {
      const updated = { ...prev[tierKey], [field]: value }

      // When provider changes, auto-fill model and env key
      if (field === 'provider' && typeof value === 'string') {
        const prov = providers.find(p => p.id === value)
        if (prov) {
          const defaultModel = prov.models.find(m => m.is_default)
          updated.model = defaultModel?.id || prov.models[0]?.id || ''
          updated.api_key_env = prov.env_key || ''
        } else {
          updated.model = ''
          updated.api_key_env = ''
        }
        // Clear test result and key input when provider changes
        setTestResults(prev => ({ ...prev, [tierKey]: null }))
        setApiKeys(prev => ({ ...prev, [tierKey]: '' }))
      }

      return { ...prev, [tierKey]: updated }
    })
  }

  // Test API key
  const handleTest = async (tierKey: string) => {
    setTesting(tierKey)
    setTestResults(prev => ({ ...prev, [tierKey]: null }))
    try {
      const data = await client.post('/llm/test-key', { tier: tierKey })
      setTestResults(prev => ({ ...prev, [tierKey]: data.success ? 'success' : 'error' }))
      if (data.success) {
        toast.success(`${TIER_LABELS[tierKey].title} API Key 验证通过`)
      } else {
        toast.error(data.error || '验证失败')
      }
    } catch {
      setTestResults(prev => ({ ...prev, [tierKey]: 'error' }))
      toast.error('测试请求失败')
    } finally {
      setTesting(null)
    }
  }

  const handleSave = async () => {
    if (!tiers.tier1.provider || !tiers.tier1.model) {
      toast.error('请配置主模型 (Tier 1)')
      return
    }

    setSaving(true)
    try {
      const tiersPatch: Record<string, any> = {}
      for (const tierKey of ['tier1', 'tier2', 'tier3']) {
        const t = tiers[tierKey]
        tiersPatch[tierKey] = {
          provider: t.provider,
          model: t.model,
          api_key_env: t.api_key_env,
          ...(tierKey !== 'tier1' ? { enabled: t.enabled } : {}),
          // Include API key only if user entered a new one
          ...(apiKeys[tierKey] ? { api_key: apiKeys[tierKey] } : {}),
        }
      }
      await patchConfig({ llm: { ...config.llm, tiers: tiersPatch } } as any)
      // Clear key inputs after save
      setApiKeys({})
      setSaveStatus('saved')
      toast.success('LLM 配置已保存并生效')
      // Auto-reset status after 10s
      setTimeout(() => setSaveStatus('idle'), 10000)
    } catch {
      setSaveStatus('error')
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text mb-1">模型配置</h3>
        <p className="text-sm text-text-muted mb-4">
          配置三级模型，主模型不可用时自动降级到备选模型
        </p>
      </div>

      {(['tier1', 'tier2', 'tier3'] as const).map(tierKey => {
        const tier = tiers[tierKey]
        const meta = TIER_LABELS[tierKey]
        const isOptional = tierKey !== 'tier1'
        const isDisabled = isOptional && !tier.enabled
        const serverTier = serverTiers[tierKey]
        const hasKey = serverTier?.api_key_set ?? false
        const maskedKey = serverTier?.api_key_masked ?? ''
        const models = getModelsForProvider(tier.provider)
        const testResult = testResults[tierKey]
        const isTesting = testing === tierKey
        const userKey = apiKeys[tierKey] || ''
        const isKeyVisible = showKeys[tierKey] ?? false

        return (
          <div
            key={tierKey}
            className={`border rounded-xl p-5 transition-all ${
              isDisabled
                ? 'border-border/50 bg-bg/30 opacity-60'
                : 'border-border bg-surface'
            }`}
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                  tierKey === 'tier1' ? 'bg-accent' : tierKey === 'tier2' ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  {meta.num}
                </span>
                <div>
                  <div className="text-sm font-semibold text-text">
                    {meta.title}
                    {!isOptional && <span className="ml-1.5 text-xs text-accent font-normal">必选</span>}
                  </div>
                  <div className="text-xs text-text-muted">{meta.desc}</div>
                </div>
              </div>

              {/* Enable toggle for tier2/3 */}
              {isOptional && (
                <div
                  onClick={() => updateTier(tierKey, 'enabled', !tier.enabled)}
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${
                    tier.enabled ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    tier.enabled ? 'left-5' : 'left-1'
                  }`} />
                </div>
              )}
            </div>

            {/* Provider + Model row */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 ${isDisabled ? 'pointer-events-none' : ''}`}>
              {/* Provider selector */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">服务商</label>
                <div className="relative">
                  <select
                    value={tier.provider}
                    onChange={e => updateTier(tierKey, 'provider', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text bg-bg appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="">选择服务商...</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name_zh} ({p.name})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">模型</label>
                <div className="relative">
                  <select
                    value={tier.model}
                    onChange={e => updateTier(tierKey, 'model', e.target.value)}
                    disabled={!tier.provider}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text bg-bg appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
                  >
                    <option value="">{tier.provider ? '选择模型...' : '先选择服务商'}</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name_zh || m.name}
                        {m.is_default ? ' (默认)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* API Key row */}
            {tier.provider && (
              <div className={`${isDisabled ? 'pointer-events-none' : ''}`}>
                <label className="block text-xs font-medium text-text-muted mb-1">API KEY</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isKeyVisible ? 'text' : 'password'}
                      value={userKey || (isKeyVisible ? maskedKey : (hasKey ? maskedKey : ''))}
                      onChange={e => setApiKeys(prev => ({ ...prev, [tierKey]: e.target.value }))}
                      placeholder={hasKey ? '已配置 (留空保持不变)' : '请输入 API Key'}
                      className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm text-text bg-bg focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys(prev => ({ ...prev, [tierKey]: !prev[tierKey] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      {isKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* KEY status badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    hasKey
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {hasKey ? <Check size={12} /> : <X size={12} />}
                    {hasKey ? '已配置' : '未配置'}
                  </span>

                  {/* Test button */}
                  <button
                    type="button"
                    onClick={() => handleTest(tierKey)}
                    disabled={!hasKey || isTesting}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
                      testResult === 'success'
                        ? 'bg-green-500 text-white'
                        : testResult === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {isTesting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : testResult === 'success' ? (
                      <Check size={12} />
                    ) : testResult === 'error' ? (
                      <X size={12} />
                    ) : (
                      <Zap size={12} />
                    )}
                    测试
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Info box */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
        <div className="text-xs text-text-muted leading-relaxed">
          <strong className="text-text">自动降级机制：</strong>
          当主模型调用失败、限流或预算超限时，系统自动切换到下一级模型。
          可直接输入 API Key，也可在服务器 .env 文件中配置。
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-in fade-in">
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
