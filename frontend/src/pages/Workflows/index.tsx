/**
 * 工作流管理页面 — 含「全部工作流」和「定时/触发」两个子 tab。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, GitBranch, Clock, Trash2, Play, Loader2, Sparkles,
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import TriggerPanel from './TriggerPanel'
import WorkflowGeneratorModal from '../Chat/WorkflowGeneratorModal'
import { listWorkflows, deleteWorkflow, executeWorkflow, type WFWorkflow } from '../../api/workflow'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

type Tab = 'workflows' | 'scheduled'

export default function Workflows() {
  const [tab, setTab] = useState<Tab>('workflows')
  const [showGenerator, setShowGenerator] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="工作流"
          description={tab === 'workflows' ? '管理和编辑工作流' : '管理定时与触发任务'}
        />
        {tab === 'workflows' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerator(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-accent/40 text-accent rounded-lg hover:bg-accent/10 transition-colors shrink-0"
            >
              <Sparkles size={14} /> AI 创建
            </button>
            <Link
              to="/workflows/visual/new"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors shrink-0"
            >
              <Plus size={14} /> New Workflow
            </Link>
          </div>
        )}
      </div>

      <WorkflowGeneratorModal open={showGenerator} onClose={() => setShowGenerator(false)} />

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        <button
          onClick={() => setTab('workflows')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'workflows'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          全部工作流
        </button>
        <button
          onClick={() => setTab('scheduled')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'scheduled'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          定时 / 触发
        </button>
      </div>

      {tab === 'workflows' ? <WorkflowList /> : <ScheduledList />}
    </div>
  )
}

/* ── 全部工作流 ────────────────────────────────────────── */

function WorkflowList() {
  const navigate = useNavigate()
  const [visualWorkflows, setVisualWorkflows] = useState<WFWorkflow[]>([])
  const [vLoading, setVLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [executing, setExecuting] = useState<string | null>(null)

  useEffect(() => {
    listWorkflows()
      .then(setVisualWorkflows)
      .catch(console.error)
      .finally(() => setVLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteWorkflow(deleteTarget.id)
      setVisualWorkflows(prev => prev.filter(w => w.id !== deleteTarget.id))
    } catch (e: any) {
      console.error('Delete failed:', e)
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  if (vLoading) return <LoadingSpinner fullPage />

  if (visualWorkflows.length === 0) return <EmptyState title="暂无工作流" />

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {visualWorkflows.map(wf => (
          <div
            key={wf.id}
            className="bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors group relative"
          >
            <Link to={`/workflows/visual/${wf.id}`} className="block">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 pr-8">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-text truncate group-hover:text-accent transition-colors">
                      {wf.name}
                    </h4>
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      wf.active ? 'bg-success/10 text-success' : 'bg-border text-text-muted'
                    }`}>
                      {wf.active ? '已激活' : '未激活'}
                    </span>
                  </div>
                  {wf.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                      {wf.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <GitBranch size={10} />
                  {(wf as any).nodeCount ?? wf.nodes?.length ?? 0} nodes
                </span>
                {wf.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(wf.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setExecuting(wf.id)
                  try {
                    toast.loading('正在执行...', { id: `wf-run-${wf.id}` })
                    await executeWorkflow(wf.id)
                    toast.success(`「${wf.name}」执行完成`, { id: `wf-run-${wf.id}` })
                    navigate(`/workflows/visual/${wf.id}`)
                  } catch (err: any) {
                    toast.error(err.message || '执行失败', { id: `wf-run-${wf.id}` })
                  }
                  setExecuting(null)
                }}
                disabled={executing === wf.id}
                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-all disabled:opacity-50"
                title="执行工作流"
              >
                {executing === wf.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Play size={13} />}
              </button>
              <button
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDeleteTarget({ id: wf.id, name: wf.name })
                }}
                className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-all"
                title="删除工作流"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="bg-surface border border-border rounded-xl shadow-xl w-[400px] p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-error/10">
                <Trash2 size={18} className="text-error" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">确认删除工作流</h3>
                <p className="text-[11px] text-text-muted mt-0.5">此操作不可撤销</p>
              </div>
            </div>

            <div className="mb-5 px-3 py-2.5 bg-bg rounded-lg border border-border">
              <p className="text-xs text-text font-medium">{deleteTarget.name}</p>
              <p className="text-[10px] text-text-muted mt-0.5">ID: {deleteTarget.id}</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs text-white bg-error rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── 定时/触发 ─────────────────────────────────────────── */

function ScheduledList() {
  // Unified trigger system replaces legacy heartbeat list
  return <TriggerPanel />
}
