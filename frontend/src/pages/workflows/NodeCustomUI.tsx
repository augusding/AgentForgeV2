import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

interface CProps { config: Record<string, any>; onChange: (c: Record<string, any>) => void; inputData?: any }
const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
const lbl = "text-xs font-medium mb-1.5 block"

export const hasCustomUI = (_t: string) => true  // all nodes have custom UI now

export default function NodeCustomUI({ nodeType, ...p }: CProps & { nodeType: string }) {
  if (nodeType === 'http') return <HttpUI {...p} />
  if (nodeType === 'ai') return <AiUI {...p} />
  if (nodeType === 'code') return <CodeUI {...p} />
  if (nodeType === 'scheduleTrigger') return <ScheduleUI config={p.config} onChange={p.onChange} />
  if (['feishu', 'dingtalk', 'wecom'].includes(nodeType)) return <MsgUI nodeType={nodeType} {...p} />
  if (nodeType === 'manualTrigger') return <ManualTriggerUI />
  if (nodeType === 'webhookTrigger') return <WebhookTriggerUI {...p} />
  if (nodeType === 'email') return <EmailUI {...p} />
  if (nodeType === 'notification') return <NotifUI {...p} />
  if (nodeType === 'set') return <SetUI {...p} />
  if (nodeType === 'excel') return <ExcelUI {...p} />
  if (nodeType === 'document') return <DocUI {...p} />
  if (nodeType === 'database') return <DbUI {...p} />
  if (nodeType === 'scraper') return <ScraperUI {...p} />
  if (nodeType === 'kvStore') return <KvUI {...p} />
  if (nodeType === 'if' || nodeType === 'condition') return <IfUI {...p} />
  return null  // fallback to generic
}

function Sec({ children, title, collapsed, onToggle }: { children: React.ReactNode; title: string; collapsed?: boolean; onToggle?: () => void }) {
  return <div className="space-y-3 pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
    <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider w-full" style={{ color: 'var(--text-muted)' }}>
      {onToggle && (collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />)}{title}</button>
    {(!onToggle || !collapsed) && children}</div>
}

/* ── HTTP ── */
function HttpUI({ config: c, onChange }: CProps) {
  const [showAuth, setShowAuth] = useState(!!c.authType && c.authType !== 'none')
  const [showAdv, setShowAdv] = useState(false)
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-5">
    <Sec title="基本设置">
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>请求</label>
        <div className="flex gap-2">
          <select value={c.method || 'GET'} onChange={e => s('method', e.target.value)} className="w-[100px] px-3 py-2.5 rounded-lg text-xs font-bold outline-none" style={st}>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}</select>
          <input value={c.url || ''} onChange={e => s('url', e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder="https://api.example.com/data" /></div></div>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>Headers</label><KV value={c.headers} onChange={v => s('headers', v)} kp="Content-Type" vp="application/json" /></div>
      {['POST', 'PUT', 'PATCH'].includes(c.method || '') && <div>
        <div className="flex items-center justify-between mb-1.5"><label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Body</label>
          <select value={c.bodyType || 'json'} onChange={e => s('bodyType', e.target.value)} className="px-2 py-0.5 rounded text-[10px] outline-none" style={st}>
            <option value="json">JSON</option><option value="text">文本</option></select></div>
        <textarea value={c.body || ''} onChange={e => s('body', e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ ...st, minHeight: 80 }}
          placeholder={'{\n  "key": "value"\n}'} /></div>}
    </Sec>
    <Sec title="认证" collapsed={!showAuth} onToggle={() => setShowAuth(!showAuth)}>
      <select value={c.authType || 'none'} onChange={e => s('authType', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
        <option value="none">无</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="apikey">API Key</option></select>
      {c.authType === 'bearer' && <input value={c.authToken || ''} onChange={e => s('authToken', e.target.value)} type="password" className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono" style={st} placeholder="Token" />}
      {c.authType === 'basic' && <div className="flex gap-2"><input value={c.authUser || ''} onChange={e => s('authUser', e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="用户名" />
        <input value={c.authPass || ''} onChange={e => s('authPass', e.target.value)} type="password" className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="密码" /></div>}
      {c.authType === 'apikey' && <div className="flex gap-2"><input value={c.authKeyName || ''} onChange={e => s('authKeyName', e.target.value)} className="w-[40%] px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="Header名" />
        <input value={c.authKeyValue || ''} onChange={e => s('authKeyValue', e.target.value)} type="password" className="flex-1 px-3 py-2 rounded-lg text-xs outline-none font-mono" style={st} placeholder="Key" /></div>}
    </Sec>
    <Sec title="高级" collapsed={!showAdv} onToggle={() => setShowAdv(!showAdv)}>
      <div className="flex gap-3"><div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>超时(秒)</label>
        <input type="number" value={c.timeout || 30} onChange={e => s('timeout', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} /></div>
        <div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>重试</label>
        <input type="number" value={c.retries || 0} onChange={e => s('retries', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} min={0} max={5} /></div></div>
    </Sec>
  </div>
}

/* ── AI ── */
function AiUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  const op = c.operation || 'generate'; const [showAdv, setShowAdv] = useState(false)
  return <div className="space-y-5">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>操作类型</label>
      <div className="grid grid-cols-5 gap-1.5">{[
        { v: 'generate', l: '生成', i: '✨' }, { v: 'classify', l: '分类', i: '🏷️' }, { v: 'extract', l: '提取', i: '📋' },
        { v: 'summarize', l: '摘要', i: '📝' }, { v: 'route', l: '路由', i: '🔀' },
      ].map(o => <button key={o.v} onClick={() => s('operation', o.v)}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg ${op === o.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
        style={{ background: op === o.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <span className="text-base">{o.i}</span><span className="text-[10px] font-medium" style={{ color: op === o.v ? 'var(--accent)' : 'var(--text)' }}>{o.l}</span></button>)}</div></div>
    {op === 'generate' && <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>提示词</label>
      <textarea value={c.prompt || ''} onChange={e => s('prompt', e.target.value)} rows={6} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 100 }}
        placeholder={'分析数据：\n{{ $input.text }}'} /></div>}
    {op === 'classify' && <><div><label className={lbl} style={{ color: 'var(--text-muted)' }}>分类类别</label>
      <TagInput value={c.categories || ''} onChange={v => s('categories', v)} placeholder="输入类别后回车" /></div>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>指令(可选)</label>
      <input value={c.instruction || ''} onChange={e => s('instruction', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="只输出类别名" /></div></>}
    {op === 'extract' && <><div><label className={lbl} style={{ color: 'var(--text-muted)' }}>提取字段</label>
      <KV value={c.extractionSchema} onChange={v => s('extractionSchema', v)} kp="字段名" vp="说明" /></div>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>指令</label>
      <input value={c.instruction || ''} onChange={e => s('instruction', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} /></div></>}
    {op === 'summarize' && <div className="flex gap-3"><div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>最大字数</label>
      <input type="number" value={c.maxLength || 200} onChange={e => s('maxLength', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} /></div>
      <div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>指令</label>
      <input value={c.instruction || ''} onChange={e => s('instruction', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="保留数据" /></div></div>}
    {op === 'route' && <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>分支描述</label>
      <textarea value={c.routeDescriptions || ''} onChange={e => s('routeDescriptions', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={st}
        placeholder={'客服: 产品使用\n技术: Bug\n投诉: 不满'} /></div>}
    <Sec title="模型设置" collapsed={!showAdv} onToggle={() => setShowAdv(!showAdv)}>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>系统提示词</label>
        <textarea value={c.systemPrompt || ''} onChange={e => s('systemPrompt', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={st} placeholder="你是专业分析师..." /></div>
      <div><div className="flex items-center justify-between mb-1"><label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>温度</label>
        <span className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>{(c.temperature ?? 0.7).toFixed(1)}</span></div>
        <input type="range" min="0" max="2" step="0.1" value={c.temperature ?? 0.7} onChange={e => s('temperature', parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, var(--accent) ${((c.temperature ?? 0.7) / 2) * 100}%, var(--border) 0%)` }} />
        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}><span>精确</span><span>平衡</span><span>创意</span></div></div>
    </Sec>
  </div>
}

/* ── Code ── */
function CodeUI({ config: c, onChange, inputData }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v }); const code = c.code || ''; const lines = code.split('\n')
  return <div className="space-y-4">
    <div><div className="flex items-center justify-between mb-1.5"><label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Python 代码</label>
      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{lines.length} 行</span></div>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-2 py-2 text-right select-none shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', minWidth: 32 }}>
          {lines.map((_: string, i: number) => <div key={i} className="text-[10px] font-mono leading-[20px]">{i + 1}</div>)}</div>
        <textarea value={code} onChange={e => s('code', e.target.value)} className="flex-1 px-3 py-2 text-xs font-mono outline-none resize-y leading-[20px]"
          style={{ background: 'var(--bg-surface)', color: 'var(--text)', minHeight: 200, tabSize: 4 }} spellCheck={false}
          placeholder={'# result 变量作为输出\nresult = {"count": len(items)}'} /></div></div>
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>📖 可用变量</div>
      <div className="space-y-1.5">{[
        { n: 'input_data', d: '上游数据 (dict)', c: '#3b82f6' }, { n: 'variables', d: '全局变量 (dict)', c: '#22c55e' },
        { n: 'items', d: 'input_data 快捷引用', c: '#f59e0b' }, { n: 'result', d: '设置此变量作为输出', c: '#ef4444' },
      ].map(v => <button key={v.n} onClick={() => { navigator.clipboard.writeText(v.n); toast.success(`已复制: ${v.n}`) }}
        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-[var(--bg-hover)]">
        <code className="text-[10px] font-mono" style={{ color: v.c }}>{v.n}</code>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{v.d}</span></button>)}</div>
      {inputData && typeof inputData === 'object' && <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>input_data 字段：</div>
        <div className="flex flex-wrap gap-1">{Object.keys(inputData).slice(0, 10).map(k =>
          <button key={k} onClick={() => { navigator.clipboard.writeText(`input_data["${k}"]`); toast.success('已复制') }}
            className="px-1.5 py-0.5 rounded text-[9px] font-mono hover:bg-[var(--accent)] hover:text-white" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>{k}</button>)}</div></div>}
    </div>
  </div>
}

/* ── Schedule ── */
function ScheduleUI({ config: c, onChange }: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const [mode, setMode] = useState<'simple' | 'cron'>(c._scheduleMode ? 'simple' : (c.cron ? 'cron' : 'simple'))
  const [sm, setSm] = useState(c._scheduleMode || 'daily')
  const upd = (freq: string, h?: string, m?: string, wd?: string) => {
    setSm(freq); const hr = h ?? c._hour ?? '9'; const mn = m ?? c._minute ?? '0'; const w = wd ?? c._weekday ?? '1'
    let cron = ''; if (freq === 'hourly') cron = `${mn} * * * *`; else if (freq === 'daily') cron = `${mn} ${hr} * * *`
    else if (freq === 'weekly') cron = `${mn} ${hr} * * ${w}`; else cron = `${mn} ${hr} 1 * *`
    onChange({ ...c, cron, _scheduleMode: freq, _hour: hr, _minute: mn, _weekday: w })
  }
  const desc = sm === 'hourly' ? `每小时第 ${c._minute || 0} 分` : sm === 'daily' ? `每天 ${(c._hour || '9').toString().padStart(2, '0')}:${(c._minute || '0').toString().padStart(2, '0')}` :
    sm === 'weekly' ? `每周${'日一二三四五六'[parseInt(c._weekday || '1')]} ${(c._hour || '9').toString().padStart(2, '0')}:${(c._minute || '0').toString().padStart(2, '0')}` :
    `每月1日 ${(c._hour || '9').toString().padStart(2, '0')}:${(c._minute || '0').toString().padStart(2, '0')}`

  return <div className="space-y-4">
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {(['simple', 'cron'] as const).map(m => <button key={m} onClick={() => setMode(m)} className="flex-1 py-2 text-xs font-medium"
        style={{ background: mode === m ? 'var(--accent)' : 'var(--bg-surface)', color: mode === m ? 'white' : 'var(--text-muted)' }}>{m === 'simple' ? '简单模式' : 'Cron'}</button>)}</div>
    {mode === 'simple' ? <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">{[{ v: 'hourly', l: '每小时', i: '⏰' }, { v: 'daily', l: '每天', i: '📅' }, { v: 'weekly', l: '每周', i: '📆' }, { v: 'monthly', l: '每月', i: '🗓️' }].map(x =>
        <button key={x.v} onClick={() => upd(x.v)} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg ${sm === x.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: sm === x.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <span className="text-lg">{x.i}</span><span className="text-[10px] font-medium" style={{ color: sm === x.v ? 'var(--accent)' : 'var(--text)' }}>{x.l}</span></button>)}</div>
      {sm !== 'hourly' && <div className="flex gap-3">
        {sm === 'weekly' && <div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>星期</label>
          <select value={c._weekday || '1'} onChange={e => upd(sm, undefined, undefined, e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
            {'日一二三四五六'.split('').map((d, i) => <option key={i} value={i}>星期{d}</option>)}</select></div>}
        <div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>时</label>
          <select value={c._hour || '9'} onChange={e => upd(sm, e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}</select></div>
        <div className="flex-1"><label className={lbl} style={{ color: 'var(--text-muted)' }}>分</label>
          <select value={c._minute || '0'} onChange={e => upd(sm, undefined, e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
            {[0, 5, 10, 15, 20, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}</select></div></div>}
      {sm === 'hourly' && <div className="w-1/2"><label className={lbl} style={{ color: 'var(--text-muted)' }}>分钟</label>
        <select value={c._minute || '0'} onChange={e => upd(sm, undefined, e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
          {[0, 5, 10, 15, 20, 30, 45].map(m => <option key={m} value={m}>第 {m} 分</option>)}</select></div>}
      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}>⏰ {desc} 执行</div>
    </div> : <div className="space-y-3">
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>Cron 表达式</label>
        <input value={c.cron || '0 9 * * *'} onChange={e => onChange({ ...c, cron: e.target.value })} className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none" style={st} placeholder="分 时 日 月 周" /></div>
      <div className="text-[10px] px-3 py-2 rounded-lg space-y-0.5" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
        <div><code style={{ color: 'var(--accent)' }}>0 9 * * *</code> → 每天 09:00</div>
        <div><code style={{ color: 'var(--accent)' }}>0 */2 * * *</code> → 每 2 小时</div>
        <div><code style={{ color: 'var(--accent)' }}>30 8 * * 1-5</code> → 工作日 08:30</div></div>
    </div>}
  </div>
}

/* ── Messaging ── */
function MsgUI({ nodeType, config: c, onChange }: CProps & { nodeType: string }) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  const pn = nodeType === 'feishu' ? '飞书' : nodeType === 'dingtalk' ? '钉钉' : '企微'
  const ph = nodeType === 'feishu' ? 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx' : nodeType === 'dingtalk' ? 'https://oapi.dingtalk.com/robot/send?access_token=xxx' : 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>{pn} Webhook URL</label>
      <input value={c.webhookUrl || ''} onChange={e => s('webhookUrl', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs font-mono outline-none" style={st} placeholder={ph} />
      <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{pn}群设置→机器人→获取 Webhook</div></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>格式</label>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {(['text', 'markdown'] as const).map(t => <button key={t} onClick={() => s('msgType', t)} className="flex-1 py-2 text-xs"
          style={{ background: (c.msgType || 'text') === t ? 'var(--accent)' : 'var(--bg-surface)', color: (c.msgType || 'text') === t ? 'white' : 'var(--text-muted)' }}>{t === 'text' ? '文本' : 'Markdown'}</button>)}</div></div>
    {c.msgType === 'markdown' && <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>标题</label>
      <input value={c.title || ''} onChange={e => s('title', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="通知标题" /></div>}
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>内容</label>
      <textarea value={c.content || ''} onChange={e => s('content', e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 80 }}
        placeholder={c.msgType === 'markdown' ? '## 通知\n{{ $input.summary }}' : '{{ $input.summary }}'} /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>📱 预览</label>
      <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white"
            style={{ background: nodeType === 'feishu' ? '#3370ff' : nodeType === 'dingtalk' ? '#0089ff' : '#07c160' }}>{pn[0]}</div>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text)' }}>机器人</span></div>
        {c.title && c.msgType === 'markdown' && <div className="text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>{c.title}</div>}
        <div className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{c.content || '(空)'}</div>
      </div></div>
  </div>
}

/* ── Shared ── */
function KV({ value, onChange, kp, vp }: { value: any; onChange: (v: string) => void; kp?: string; vp?: string }) {
  let pairs: [string, string][] = []; try { const o = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {})
    if (typeof o === 'object' && !Array.isArray(o)) pairs = Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]) } catch {}
  const upd = (p: [string, string][]) => { const o: Record<string, string> = {}; for (const [k, v] of p) if (k.trim()) o[k.trim()] = v; onChange(JSON.stringify(o)) }
  return <div className="space-y-1.5">{pairs.map(([k, v], i) => <div key={i} className="flex gap-1.5">
    <input value={k} onChange={e => { const n = [...pairs]; n[i] = [e.target.value, v]; upd(n) }} placeholder={kp || 'Key'} className="w-[35%] px-2 py-1.5 rounded text-xs outline-none" style={st} />
    <input value={v} onChange={e => { const n = [...pairs]; n[i] = [k, e.target.value]; upd(n) }} placeholder={vp || 'Value'} className="flex-1 px-2 py-1.5 rounded text-xs outline-none" style={st} />
    <button onClick={() => upd(pairs.filter((_, j) => j !== i))} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button></div>)}
    <button onClick={() => upd([...pairs, ['', '']])} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={10} /> 添加</button></div>
}

function TagInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const tags = (value || '').split(',').map(t => t.trim()).filter(Boolean); const [inp, setInp] = useState('')
  const add = (t: string) => { if (t.trim() && !tags.includes(t.trim())) onChange([...tags, t.trim()].join(', ')); setInp('') }
  return <div><div className="flex flex-wrap gap-1.5 mb-1.5">{tags.map((t, i) => <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
    style={{ background: 'var(--accent)20', color: 'var(--accent)', border: '1px solid var(--accent)40' }}>{t}
    <button onClick={() => onChange(tags.filter((_, j) => j !== i).join(', '))} className="hover:text-[var(--error)]">×</button></span>)}</div>
    <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp) } }}
      className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder={placeholder} /></div>
}

/* ── Manual Trigger ── */
function ManualTriggerUI() {
  return <div className="space-y-4">
    <div className="rounded-xl p-5 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="text-3xl mb-3">▶️</div><h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>手动触发</h3>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>点击"执行"按钮启动，无需配置。</p></div>
    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      💡 可通过 API 传入触发数据 | 下游用 {'{{ $input.trigger }}'} 获取</div></div>
}

/* ── Webhook Trigger ── */
function WebhookTriggerUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  const url = `${window.location.origin}/api/v1/webhook/${c.webhookId || '<workflow_id>'}`
  return <div className="space-y-4">
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <label className={lbl} style={{ color: 'var(--text-muted)' }}>Webhook URL</label>
      <div className="flex gap-1.5"><input value={url} readOnly className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ ...st, background: 'var(--bg)' }} />
        <button onClick={() => { navigator.clipboard.writeText(url); toast.success('已复制') }} className="px-3 py-2 rounded-lg text-xs text-white shrink-0" style={{ background: 'var(--accent)' }}>复制</button></div>
      <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>外部系统 POST 此 URL 触发工作流</p></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>响应消息</label>
      <input value={c.responseMessage || ''} onChange={e => s('responseMessage', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="Webhook received" /></div>
    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <pre className="text-[10px] font-mono">curl -X POST {url} -H "Content-Type: application/json" -d '{"{"}message":"hello"{"}"}'</pre></div>
  </div>
}

/* ── Email ── */
function EmailUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>收件人</label>
      <input value={c.to || ''} onChange={e => s('to', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none" style={st} placeholder="user@example.com（逗号分隔多个）" /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>主题</label>
      <input value={c.subject || ''} onChange={e => s('subject', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none" style={st} placeholder="{{ $input.title }} - 通知" /></div>
    <div className="flex items-center gap-3"><label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>格式</label>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[false, true].map(v => <button key={String(v)} onClick={() => s('html', v)} className="px-3 py-1 text-[10px]"
          style={{ background: (c.html || false) === v ? 'var(--accent)' : 'var(--bg-surface)', color: (c.html || false) === v ? 'white' : 'var(--text-muted)' }}>{v ? 'HTML' : '文本'}</button>)}</div></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>正文</label>
      <textarea value={c.body || ''} onChange={e => s('body', e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 120 }}
        placeholder={c.html ? '<h1>标题</h1>\n<p>{{ $input.summary }}</p>' : '{{ $input.summary }}'} /></div>
    <div className="text-[10px] rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>⚙️ SMTP 环境变量: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS</div>
  </div>
}

/* ── Notification ── */
function NotifUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>标题</label>
      <input value={c.title || ''} onChange={e => s('title', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none" style={st} placeholder="工作流通知" /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>内容</label>
      <textarea value={c.message || ''} onChange={e => s('message', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 60 }} placeholder="{{ $input.summary }}" /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>方式</label>
      <div className="grid grid-cols-2 gap-2">{[{ v: 'system', l: '🔔 系统推送' }, { v: 'log', l: '📝 仅日志' }].map(o =>
        <button key={o.v} onClick={() => s('channel', o.v)} className={`p-3 rounded-lg text-left text-xs ${(c.channel || 'system') === o.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>{o.l}</button>)}</div></div>
  </div>
}

/* ── Set Variables ── */
function SetUI({ config: c, onChange, inputData }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-4">
    <div><div className="flex items-center justify-between mb-2"><label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>变量赋值</label>
      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>值支持 {'{{ }}'}</span></div>
      <KV value={c.assignments} onChange={v => s('assignments', v)} kp="变量名" vp="{{ $input.field }}" /></div>
    {inputData && typeof inputData === 'object' && <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>上游字段</div>
      <div className="flex flex-wrap gap-1.5">{Object.keys(Array.isArray(inputData) ? (inputData[0] || {}) : inputData).slice(0, 15).map(k =>
        <button key={k} onClick={() => { navigator.clipboard.writeText(`{{ $input.${k} }}`); toast.success('已复制') }}
          className="px-2 py-1 rounded text-[9px] font-mono hover:bg-[var(--accent)] hover:text-white" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>{k}</button>)}</div></div>}
    <div className="text-[10px] rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>💡 后续节点用 {'{{ $vars.变量名 }}'} 引用</div>
  </div>
}

/* ── Excel ── */
function ExcelUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  const action = c.action || 'read'; const sourceType = c.source_type || 'file'
  const [files, setFiles] = useState<any[]>([]); const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(''); const [preview, setPreview] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false); const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sourceType === 'file' && action !== 'create') {
      setLoading(true)
      client.get('/files?exts=xlsx,xls,csv').then((r: any) => setFiles(r.files || [])).catch(() => setFiles([])).finally(() => setLoading(false))
    }
  }, [sourceType, action])

  useEffect(() => {
    if (c.path && action !== 'create') {
      client.get(`/files/preview/${c.path}`).then((r: any) => setPreview(r)).catch(() => setPreview(null))
    } else { setPreview(null) }
  }, [c.path, action])

  const filtered = files.filter(f => !search || f.filename.toLowerCase().includes(search.toLowerCase()))
  const fmtSize = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)}MB` : `${Math.round(b/1024)}KB`
  const fmtTime = (ts: number) => { const d = (Date.now() - ts * 1000) / 1000; return d < 3600 ? `${Math.floor(d/60)}m` : d < 86400 ? `${Math.floor(d/3600)}h` : `${Math.floor(d/86400)}d` }

  const handleUpload = async (file: File) => {
    const form = new FormData(); form.append('file', file); form.append('target', 'chat')
    try {
      const r: any = await client.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (r.file_id) { s('path', (r.path || '').replace(/\\/g, '/')); toast.success(`${file.name} 上传成功`)
        client.get('/files?exts=xlsx,xls,csv').then((res: any) => setFiles(res.files || [])) }
    } catch { toast.error('上传失败') }
  }

  return <div className="space-y-4">
    {/* 操作类型 */}
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>操作</label>
      <div className="grid grid-cols-3 gap-2">{[{ v: 'read', l: '📖 读取' }, { v: 'create', l: '📝 创建' }, { v: 'append', l: '➕ 追加' }].map(o =>
        <button key={o.v} onClick={() => s('action', o.v)} className={`py-2.5 rounded-lg text-center text-xs font-medium ${action === o.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: action === o.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)', color: action === o.v ? 'var(--accent)' : 'var(--text)' }}>{o.l}</button>)}</div></div>

    {/* 读取/追加 → 文件选择器 */}
    {action !== 'create' && <>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>文件来源</label>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[{ v: 'file', l: '选择文件' }, { v: 'upstream', l: '上游引用' }, { v: 'manual', l: '上传/输入' }].map(t =>
            <button key={t.v} onClick={() => s('source_type', t.v)} className="flex-1 py-2 text-[11px] font-medium"
              style={{ background: sourceType === t.v ? 'var(--accent)' : 'transparent', color: sourceType === t.v ? '#fff' : 'var(--text-muted)' }}>{t.l}</button>)}</div></div>

      {sourceType === 'file' && <div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文件..." className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-2" style={st} />
        <div className="max-h-[160px] overflow-y-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {loading ? <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>加载中...</div>
           : !filtered.length ? <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>暂无文件</div>
           : filtered.map(f => <div key={f.path} onClick={() => s('path', f.path)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs"
              style={{ background: c.path === f.path ? 'var(--accent)10' : 'transparent', borderBottom: '0.5px solid var(--border)',
                borderLeft: c.path === f.path ? '3px solid var(--accent)' : '3px solid transparent' }}>
              <span style={{ color: f.ext === 'csv' ? '#22c55e' : '#217346', fontSize: 14 }}>{f.ext === 'csv' ? '📊' : '📗'}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium" style={{ color: c.path === f.path ? 'var(--accent)' : 'var(--text)' }}>{f.filename}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.source === 'outputs' ? 'AI生成' : '上传'} · {fmtSize(f.size)} · {fmtTime(f.modified)}</div>
              </div></div>)}</div></div>}

      {sourceType === 'upstream' && <div>
        <label className={lbl} style={{ color: 'var(--text-muted)' }}>上游变量</label>
        <input value={c.upstream_var || ''} onChange={e => s('upstream_var', e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder="node_id.output_key" />
        <div className="mt-2 p-2.5 rounded-lg text-[10px]" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
          运行时从上游节点的输出中获取文件路径</div></div>}

      {sourceType === 'manual' && <div className="space-y-3">
        <div className="rounded-lg p-4 text-center cursor-pointer" onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && /\.(xlsx?|csv)$/i.test(f.name)) handleUpload(f); else toast.error('请上传 xlsx 或 csv') }}
          style={{ border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, background: dragOver ? 'var(--accent)08' : 'transparent' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>拖放 .xlsx/.csv 或点击选择</div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} /></div>
        <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>或手动输入路径</label>
          <input value={c.path || ''} onChange={e => s('path', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder="data/uploads/.../file.xlsx" /></div>
      </div>}

      {/* 已选文件预览 */}
      {c.path && preview?.type === 'table' && preview.data?.sheets?.[0] && <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--accent)08', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ fontSize: 14 }}>📗</span>
          <div className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--accent)' }}>{c.path.split('/').pop()}</div>
          <button onClick={() => { s('path', ''); setPreview(null) }} className="text-[10px] px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>清除</button>
        </div>
        <div className="max-h-[120px] overflow-auto">
          <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}><thead><tr>
            {(preview.data.sheets[0].rows?.[0]||[]).map((h: string, i: number) =>
              <th key={i} className="px-2 py-1.5 text-left font-medium sticky top-0" style={{ background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>{h}</th>)}
          </tr></thead><tbody>
            {preview.data.sheets[0].rows?.slice(1, 6).map((row: string[], ri: number) =>
              <tr key={ri}>{row.map((c2: string, ci: number) =>
                <td key={ci} className="px-2 py-1" style={{ borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }}>{c2}</td>)}</tr>)}
          </tbody></table></div>
        <div className="flex gap-2 px-2 py-1.5" style={{ borderTop: '0.5px solid var(--border)', background: 'var(--bg-surface)' }}>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{preview.data.sheets[0].total_rows || preview.data.sheets[0].rows?.length} rows</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{preview.data.sheets[0].rows?.[0]?.length} cols</span></div>
      </div>}
    </>}

    {/* 创建模式 */}
    {action === 'create' && <>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>输出路径</label>
        <input value={c.path || ''} onChange={e => s('path', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder="data/outputs/report.xlsx" /></div>
      <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>数据（留空用上游）</label>
        <textarea value={c.data || ''} onChange={e => s('data', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ ...st, minHeight: 60 }}
          placeholder={'[{"姓名": "张三", "得分": 85}]'} /></div>
    </>}

    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>工作表</label>
      <input value={c.sheet || ''} onChange={e => s('sheet', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="Sheet1（留空默认）" /></div>
  </div>
}

/* ── Document ── */
function DocUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>类型</label>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[{ v: 'create_word', l: '📄 Word' }, { v: 'create_text', l: '📝 文本' }].map(t =>
          <button key={t.v} onClick={() => s('action', t.v)} className="flex-1 py-2.5 text-xs"
            style={{ background: (c.action || 'create_word') === t.v ? 'var(--accent)' : 'var(--bg-surface)', color: (c.action || 'create_word') === t.v ? 'white' : 'var(--text-muted)' }}>{t.l}</button>)}</div></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>标题</label>
      <input value={c.title || ''} onChange={e => s('title', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none" style={st} placeholder="项目报告" /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>内容 <span className="text-[9px] font-normal">支持 Markdown</span></label>
      <textarea value={c.content || ''} onChange={e => s('content', e.target.value)} rows={10} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 150 }}
        placeholder={'# 标题\n## 第一部分\n{{ $input.ai_result }}'} /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>路径（留空自动）</label>
      <input value={c.path || ''} onChange={e => s('path', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono" style={st} placeholder="data/outputs/report.docx" /></div>
  </div>
}

/* ── Database ── */
function DbUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v }); const db = c.dbType || 'sqlite'
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>类型</label>
      <div className="grid grid-cols-3 gap-2">{[{ v: 'sqlite', l: '🗄️ SQLite' }, { v: 'mysql', l: '🐬 MySQL' }, { v: 'postgresql', l: '🐘 PG' }].map(d =>
        <button key={d.v} onClick={() => s('dbType', d.v)} className={`py-2 rounded-lg text-center text-[10px] font-medium ${db === d.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: db === d.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)', color: db === d.v ? 'var(--accent)' : 'var(--text)' }}>{d.l}</button>)}</div></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>{db === 'sqlite' ? '文件路径' : '连接字符串'}</label>
      <input value={c.connection || ''} onChange={e => s('connection', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st}
        placeholder={db === 'sqlite' ? 'data/memories.db' : 'host=localhost dbname=mydb'} /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>SQL</label>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-2 py-2 text-right select-none shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', minWidth: 28 }}>
          {(c.query || '').split('\n').map((_: string, i: number) => <div key={i} className="text-[9px] font-mono leading-[18px]">{i + 1}</div>)}</div>
        <textarea value={c.query || ''} onChange={e => s('query', e.target.value)} rows={6} className="flex-1 px-3 py-2 text-xs font-mono outline-none resize-y leading-[18px]"
          style={{ background: 'var(--bg-surface)', color: 'var(--text)', minHeight: 100 }} placeholder="SELECT * FROM table LIMIT 50" /></div></div>
    <div className="text-[10px] rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>SELECT → items 列表 | INSERT/UPDATE → affected_rows</div>
  </div>
}

/* ── Scraper ── */
function ScraperUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v })
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>网页 URL</label>
      <input value={c.url || ''} onChange={e => s('url', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder="https://example.com/page" /></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>提取方式</label>
      <div className="grid grid-cols-3 gap-2">{[{ v: 'text', l: '📝 文本' }, { v: 'html', l: '🌐 HTML' }, { v: 'json', l: '📦 JSON' }].map(e =>
        <button key={e.v} onClick={() => s('extract', e.v)} className={`py-2 rounded-lg text-center text-[10px] font-medium ${(c.extract || 'text') === e.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: (c.extract || 'text') === e.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)', color: (c.extract || 'text') === e.v ? 'var(--accent)' : 'var(--text)' }}>{e.l}</button>)}</div></div>
    {(c.extract || 'text') === 'text' && <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>关键词过滤</label>
      <input value={c.selector || ''} onChange={e => s('selector', e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder="只保留含此词的段落" /></div>}
  </div>
}

/* ── KV Store ── */
function KvUI({ config: c, onChange }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v }); const a = c.action || 'get'
  return <div className="space-y-4">
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>操作</label>
      <div className="grid grid-cols-4 gap-1.5">{[{ v: 'get', l: '📖' }, { v: 'set', l: '✏️' }, { v: 'delete', l: '🗑️' }, { v: 'list', l: '📋' }].map(o =>
        <button key={o.v} onClick={() => s('action', o.v)} className={`py-2 rounded-lg text-center text-sm ${a === o.v ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ background: a === o.v ? 'var(--accent)15' : 'var(--bg-surface)', border: '1px solid var(--border)' }}>{o.l}</button>)}</div></div>
    <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>{a === 'list' ? '前缀' : '键名'}</label>
      <input value={c.key || ''} onChange={e => s('key', e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-xs outline-none font-mono" style={st} placeholder={a === 'list' ? 'cache_' : 'my_key'} /></div>
    {a === 'set' && <div><label className={lbl} style={{ color: 'var(--text-muted)' }}>值（留空用上游）</label>
      <textarea value={c.value || ''} onChange={e => s('value', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ ...st, minHeight: 60 }} placeholder='{"data": "..."}' /></div>}
    <div className="text-[10px] rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>💾 持久化存储，跨工作流共享</div>
  </div>
}

/* ── Condition Rules (inline) ── */
function CondRules({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  let p: { combineMode: string; rules: any[] } = { combineMode: 'AND', rules: [] }
  try { p = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {}); if (!p.rules) p = { combineMode: 'AND', rules: [] } } catch {}
  const u = (n: typeof p) => onChange(JSON.stringify(n))
  const ops = [['等于', 'equals'], ['不等于', 'not_equals'], ['大于', 'gt'], ['≥', 'gte'], ['小于', 'lt'], ['≤', 'lte'], ['包含', 'contains'], ['为空', 'is_empty'], ['非空', 'is_not_empty']]
  return <div className="space-y-2">
    <div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>满足</span>
      <select value={p.combineMode} onChange={e => u({ ...p, combineMode: e.target.value })} className="px-2 py-1 rounded text-xs outline-none" style={st}>
        <option value="AND">所有 (AND)</option><option value="OR">任一 (OR)</option></select></div>
    {p.rules.map((r: any, i: number) => <div key={i} className="flex gap-1.5 items-center">
      <input value={r.field || ''} onChange={e => { const n = [...p.rules]; n[i] = { ...r, field: e.target.value }; u({ ...p, rules: n }) }} placeholder="字段" className="w-[30%] px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <select value={r.operator || 'equals'} onChange={e => { const n = [...p.rules]; n[i] = { ...r, operator: e.target.value }; u({ ...p, rules: n }) }} className="w-[25%] px-2 py-1.5 rounded text-xs outline-none" style={st}>
        {ops.map(([n, v]) => <option key={v} value={v}>{n}</option>)}</select>
      <input value={r.value || ''} onChange={e => { const n = [...p.rules]; n[i] = { ...r, value: e.target.value }; u({ ...p, rules: n }) }} placeholder="值" className="flex-1 px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <button onClick={() => u({ ...p, rules: p.rules.filter((_: any, j: number) => j !== i) })} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button></div>)}
    <button onClick={() => u({ ...p, rules: [...p.rules, { field: '', operator: 'equals', value: '' }] })} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={10} /> 添加条件</button>
  </div>
}

/* ── If / Condition ── */
function IfUI({ config: c, onChange, inputData }: CProps) {
  const s = (k: string, v: any) => onChange({ ...c, [k]: v }); const mode = c.mode || 'rules'
  return <div className="space-y-4">
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {[{ v: 'rules', l: '🎯 规则' }, { v: 'expression', l: '⚡ 表达式' }].map(m =>
        <button key={m.v} onClick={() => s('mode', m.v)} className="flex-1 py-2 text-xs font-medium"
          style={{ background: mode === m.v ? 'var(--accent)' : 'var(--bg-surface)', color: mode === m.v ? 'white' : 'var(--text-muted)' }}>{m.l}</button>)}</div>
    {mode === 'rules' ? <div>
      <CondRules value={c.conditions} onChange={(v: any) => s('conditions', v)} />
      {inputData && typeof inputData === 'object' && <div className="mt-3 rounded-lg p-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-[9px] mb-1.5" style={{ color: 'var(--text-muted)' }}>可用字段：</div>
        <div className="flex flex-wrap gap-1">{Object.keys(Array.isArray(inputData) ? (inputData[0] || {}) : inputData).slice(0, 12).map(k =>
          <span key={k} className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>{k}</span>)}</div></div>}
    </div> : <div className="space-y-2">
      <textarea value={c.expression || ''} onChange={e => s('expression', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ ...st, minHeight: 50 }}
        placeholder="$input.score > 60 and $input.status == 'active'" />
      <div className="text-[10px] rounded-lg p-2 font-mono" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <code style={{ color: 'var(--accent)' }}>$input.score {'>'} 60</code> | <code style={{ color: 'var(--accent)' }}>len($input.items) {'>'} 0</code></div>
    </div>}
    <div className="flex gap-2">
      <div className="flex-1 rounded-lg p-2 text-center text-[10px]" style={{ background: '#22c55e15', border: '1px solid #22c55e40', color: '#22c55e' }}>✅ True → 输出 0</div>
      <div className="flex-1 rounded-lg p-2 text-center text-[10px]" style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444' }}>❌ False → 输出 1</div>
    </div>
  </div>
}
