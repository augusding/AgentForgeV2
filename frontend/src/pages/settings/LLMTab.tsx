import { useState, useEffect, useMemo } from 'react'
import { Check, X, Loader2, Eye, EyeOff, Save } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

interface TierForm { provider: string; model: string; apiKeyEnv: string; apiKeyValue: string; enabled: boolean }

const LABELS: Record<string, { emoji: string; title: string; desc: string }> = {
  tier1: { emoji: '🥇', title: '主模型', desc: '首选模型，必须配置' },
  tier2: { emoji: '🥈', title: '备选 1', desc: '主模型不可用时自动切换' },
  tier3: { emoji: '🥉', title: '备选 2', desc: '前两级均不可用时切换' },
}

export default function LLMTab() {
  const [cfg, setCfg] = useState<any>(null)
  const [tiers, setTiers] = useState<Record<string, TierForm>>({
    tier1: { provider: '', model: '', apiKeyEnv: '', apiKeyValue: '', enabled: true },
    tier2: { provider: '', model: '', apiKeyEnv: '', apiKeyValue: '', enabled: false },
    tier3: { provider: '', model: '', apiKeyEnv: '', apiKeyValue: '', enabled: false },
  })
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(''); const [results, setResults] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false); const [inited, setInited] = useState(false)

  const providers = useMemo(() => cfg?.llm?.providers || [], [cfg])
  const serverTiers = useMemo(() => cfg?.llm?.tiers || {}, [cfg])

  useEffect(() => { client.get('/config').then((d: any) => setCfg(d)).catch(() => {}) }, [])

  useEffect(() => {
    if (!cfg || inited) return
    const nt: Record<string, TierForm> = { ...tiers }
    for (const k of ['tier1', 'tier2', 'tier3']) {
      const s = serverTiers[k]
      if (s) nt[k] = { provider: s.provider || '', model: s.model || '', apiKeyEnv: s.api_key_env || '', apiKeyValue: '', enabled: k === 'tier1' || (s.enabled ?? false) }
    }
    setTiers(nt); setInited(true)
  }, [cfg, inited])

  const getModels = (pid: string) => { const p = providers.find((x: any) => x.id === pid); return p?.models || [] }
  const upd = (tk: string, f: string, v: any) => {
    setTiers(prev => {
      const u = { ...prev, [tk]: { ...prev[tk], [f]: v } }
      if (f === 'provider') { const ms = getModels(v); u[tk].model = ms[0]?.id || ms[0] || '' }
      return u
    })
  }

  const test = async (tk: string) => {
    const t = tiers[tk]; if (!t.provider) return toast.error('请先选择模型')
    setTesting(tk)
    try { await client.post('/llm/test-key', { provider: t.provider, model: t.model, api_key: t.apiKeyValue || undefined })
      setResults(r => ({ ...r, [tk]: 'ok' })); toast.success(`${LABELS[tk].title} 连接成功`)
    } catch { setResults(r => ({ ...r, [tk]: 'fail' })); toast.error(`${LABELS[tk].title} 连接失败`) }
    finally { setTesting('') }
  }

  const save = async () => {
    setSaving(true)
    try {
      const p: Record<string, any> = {}
      for (const [k, v] of Object.entries(tiers)) p[k] = { provider: v.provider, model: v.model, api_key_env: v.apiKeyEnv, enabled: v.enabled, ...(v.apiKeyValue ? { api_key: v.apiKeyValue } : {}) }
      await client.post('/config', { llm: { tiers: p } }); toast.success('配置已保存')
      setTiers(prev => { const u = { ...prev }; for (const k of Object.keys(u)) u[k] = { ...u[k], apiKeyValue: '' }; return u })
    } catch { toast.error('保存失败') } finally { setSaving(false) }
  }

  const st = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="space-y-6">
      {['tier1', 'tier2', 'tier3'].map(tk => {
        const t = tiers[tk]; const lb = LABELS[tk]; const off = tk !== 'tier1' && !t.enabled; const r = results[tk]
        return (
          <div key={tk} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: off ? 0.5 : 1 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{lb.emoji}</span>
                <div><div className="text-sm font-medium">{lb.title}</div><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{lb.desc}</div></div>
              </div>
              <div className="flex items-center gap-3">
                {r === 'ok' && <span className="text-[10px] flex items-center gap-1" style={{ color: '#22c55e' }}><Check size={12} /> 正常</span>}
                {r === 'fail' && <span className="text-[10px] flex items-center gap-1" style={{ color: '#ef4444' }}><X size={12} /> 失败</span>}
                {tk !== 'tier1' && (
                  <button onClick={() => upd(tk, 'enabled', !t.enabled)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${t.enabled ? 'bg-[var(--accent)]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${t.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} /></button>)}
              </div>
            </div>
            {!off && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>提供商</label>
                    <select value={t.provider} onChange={e => upd(tk, 'provider', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st}>
                      <option value="">选择...</option>{providers.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}</select></div>
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>模型</label>
                    <select value={t.model} onChange={e => upd(tk, 'model', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st}>
                      <option value="">选择...</option>{getModels(t.provider).map((m: any) => <option key={m.id || m} value={m.id || m}>{m.name || m.id || m}</option>)}</select></div>
                </div>
                <div><label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>API Key {t.apiKeyEnv && <span className="font-mono text-[9px]" style={{ color: 'var(--accent)' }}>（env: {t.apiKeyEnv}）</span>}</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input type={showKeys[tk] ? 'text' : 'password'} value={t.apiKeyValue} onChange={e => upd(tk, 'apiKeyValue', e.target.value)}
                        placeholder={t.apiKeyEnv ? `已通过 ${t.apiKeyEnv} 配置` : 'sk-...'} className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none pr-8" style={st} />
                      <button onClick={() => setShowKeys(p => ({ ...p, [tk]: !p[tk] }))} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                        {showKeys[tk] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    </div>
                    <button onClick={() => test(tk)} disabled={!!testing || !t.provider} className="px-3 py-2 rounded-lg text-xs shrink-0"
                      style={{ color: 'var(--accent)', border: '1px solid var(--accent)', opacity: t.provider ? 1 : 0.5 }}>
                      {testing === tk ? <Loader2 size={14} className="animate-spin" /> : '测试连接'}</button>
                  </div>
                </div>
              </div>)}
          </div>)
      })}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm text-white font-medium"
          style={{ background: saving ? 'var(--border)' : 'var(--accent)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存配置</button>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium mb-2">配置说明</h3>
        <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
          <p>• 主模型不可用时自动降级 • API Key 可通过环境变量或直接输入 • 也可在 config.yaml 手动编辑</p>
        </div>
      </div>
    </div>
  )
}
