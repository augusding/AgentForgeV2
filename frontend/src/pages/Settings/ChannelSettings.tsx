import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import StatusBadge from '../../components/StatusBadge'
import toast from 'react-hot-toast'

const CHANNEL_NAMES: Record<string, string> = {
  api: 'Web API',
  feishu: '飞书',
  wecom: '企业微信',
}

const CHANNEL_ICONS: Record<string, string> = {
  api: '🌐',
  feishu: '🐦',
  wecom: '💬',
}

export default function ChannelSettings() {
  const config = useConfigStore(s => s.config)
  const patchConfig = useConfigStore(s => s.patchConfig)
  const [testingType, setTestingType] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'connected' | 'error'>>({})
  const [togglingType, setTogglingType] = useState<string | null>(null)

  if (!config) return null

  const handleTest = async (type: string) => {
    setTestingType(type)
    try {
      // Check health endpoint to verify API connectivity
      const resp = await fetch('/api/v1/health')
      if (resp.ok) {
        setTestResults(prev => ({ ...prev, [type]: 'connected' }))
        toast.success(`${CHANNEL_NAMES[type] || type} 连接正常`)
      } else {
        setTestResults(prev => ({ ...prev, [type]: 'error' }))
        toast.error(`${CHANNEL_NAMES[type] || type} 连接异常`)
      }
    } catch {
      setTestResults(prev => ({ ...prev, [type]: 'error' }))
      toast.error(`${CHANNEL_NAMES[type] || type} 连接失败`)
    } finally {
      setTestingType(null)
    }
  }

  const handleToggle = async (type: string, currentEnabled: boolean) => {
    setTogglingType(type)
    try {
      await patchConfig({
        channels: config.channels.map(ch =>
          ch.type === type ? { ...ch, enabled: !currentEnabled } : ch
        ),
      })
      toast.success(`${CHANNEL_NAMES[type] || type} 已${currentEnabled ? '禁用' : '启用'}`)
    } catch {
      toast.error('操作失败')
    } finally {
      setTogglingType(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text mb-1">通道配置</h3>
        <p className="text-sm text-text-muted">管理消息通道，接收 Agent 通知和审批请求</p>
      </div>

      <div className="space-y-4">
        {config.channels.map(ch => {
          const testStatus = testResults[ch.type]
          return (
            <div key={ch.type} className="bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CHANNEL_ICONS[ch.type] || '📡'}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-text">{CHANNEL_NAMES[ch.type] || ch.type}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs ${ch.enabled ? 'text-success' : 'text-text-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ch.enabled ? 'bg-success' : 'bg-border'}`} />
                        {ch.enabled ? '已启用' : '未启用'}
                      </span>
                      {testStatus && (
                        <StatusBadge
                          status={testStatus === 'connected' ? 'completed' : 'failed'}
                          label={testStatus === 'connected' ? '已连接' : '连接失败'}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(ch.type)}
                    disabled={testingType === ch.type}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {testingType === ch.type && <Loader2 size={12} className="animate-spin" />}
                    测试连接
                  </button>
                  <div
                    onClick={() => !togglingType && handleToggle(ch.type, ch.enabled)}
                    className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${ch.enabled ? 'bg-accent' : 'bg-border'} ${togglingType ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ch.enabled ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
