import { create } from 'zustand'
import type {
  BuilderSession, IntakeMessage, IntakeStatus, IntakeUIType, IntakeUIData,
  ProfilePreviewData, ValidationIssue, GenerationStatus,
  CalibrationCase, CalibrationReport, ExportSummary,
} from '../types/builder'
import {
  createBuilderSession, fetchBuilderSession, submitIntake, submitIntakeSelection,
  fetchIntakeStatus, startGeneration, fetchGenerationStatus,
  fetchProfilePreview, fetchSuggestedCases,
  submitCalibration, finalizeProfile, deployProfile,
} from '../api/builder'
import type { SuggestedCase } from '../api/builder'

const SESSION_KEY = 'agentforge_builder_session_id'

/**
 * 提取生成轮询逻辑，供 triggerGenerate 和 initSession 恢复时共用
 */
function _pollGeneration(
  sessionId: string,
  set: (partial: Partial<BuilderState> | ((s: BuilderState) => Partial<BuilderState>)) => void,
  get: () => BuilderState,
) {
  const poll = setInterval(async () => {
    try {
      const status = await fetchGenerationStatus(sessionId)
      set({ generationStatus: status })

      if (status.status === 'completed') {
        clearInterval(poll)
        set({ generating: false, issues: status.issues || [] })
        try {
          const updatedSession = await fetchBuilderSession(sessionId)
          set({ session: updatedSession })
        } catch { /* ignore */ }
        await get().loadPreview()
      } else if (status.status === 'failed') {
        clearInterval(poll)
        set({ generating: false, error: status.error || '生成失败，请重试' })
      }
    } catch {
      // 单次轮询失败不中断
    }
  }, 3000)

  // 安全超时：10 分钟
  setTimeout(() => {
    clearInterval(poll)
    const { generating } = get()
    if (generating) {
      set({ generating: false, error: '生成超时，请刷新页面重试' })
    }
  }, 600000)
}

interface BuilderState {
  // Session
  session: BuilderSession | null
  loading: boolean
  error: string | null

  // Intake
  messages: IntakeMessage[]
  intakeStatus: IntakeStatus | null
  responding: boolean
  intakeCompleted: boolean
  /** 当前期待的 UI 类型（由最新的 assistant 消息决定） */
  currentUIType: IntakeUIType
  currentUIData: IntakeUIData

  // Generation
  generating: boolean
  generationStatus: GenerationStatus | null
  preview: ProfilePreviewData | null
  issues: ValidationIssue[]

  // Calibration
  calibrating: boolean
  calibrationReport: CalibrationReport | null
  suggestedCases: SuggestedCase[]

  // Finalize / Deploy
  exporting: boolean
  exportSummary: ExportSummary | null
  deployed: boolean

  // Actions
  initSession: () => Promise<void>
  startSession: (templateId?: string) => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  sendIntake: (input: string) => Promise<void>
  sendIntakeSelection: (selectionType: IntakeUIType, selectionData: Record<string, unknown>) => Promise<void>
  refreshIntakeStatus: () => Promise<void>
  triggerGenerate: () => Promise<void>
  loadPreview: () => Promise<void>
  loadSuggestedCases: () => Promise<void>
  runCalibration: (cases: Omit<CalibrationCase, 'id'>[]) => Promise<void>
  goToPhase: (phase: BuilderSession['phase']) => Promise<void>
  triggerFinalize: () => Promise<void>
  triggerDeploy: () => Promise<void>
  reset: () => void
}

const INITIAL_STATE = {
  session: null,
  loading: false,
  error: null,
  messages: [] as IntakeMessage[],
  intakeStatus: null,
  responding: false,
  intakeCompleted: false,
  currentUIType: 'text' as IntakeUIType,
  currentUIData: {} as IntakeUIData,
  generating: false,
  generationStatus: null as GenerationStatus | null,
  preview: null,
  issues: [] as ValidationIssue[],
  calibrating: false,
  calibrationReport: null,
  suggestedCases: [] as SuggestedCase[],
  exporting: false,
  exportSummary: null,
  deployed: false,
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...INITIAL_STATE,

  /** 初始化：优先恢复已有会话 */
  initSession: async () => {
    const savedId = localStorage.getItem(SESSION_KEY)
    if (savedId) {
      set({ loading: true, error: null })
      try {
        const session = await fetchBuilderSession(savedId)
        const isIntake = session.phase === 'intake'
        const isGeneration = session.phase === 'generation'

        // 恢复会话时显示提示（仅 intake / generation 阶段走 IntakeChat）
        const restoreMessages: IntakeMessage[] =
          isIntake || isGeneration
            ? [{
                role: 'assistant' as const,
                content: isIntake
                  ? '已恢复上次的采集会话，您可以继续回答问题。如需重新开始，请点击右上角「重新开始」按钮。'
                  : '已恢复上次的会话。信息采集已完成，您可以点击下方按钮生成 AI 团队配置。',
                timestamp: new Date().toISOString(),
              }]
            : []

        set({
          session,
          loading: false,
          intakeCompleted: !isIntake,
          messages: restoreMessages,
        })

        // ── generation 阶段：检查后端生成状态，自动推进或恢复 ──
        if (isGeneration) {
          try {
            const genStatus = await fetchGenerationStatus(savedId)
            if (genStatus.status === 'completed') {
              // 生成已完成 → 刷新 session（phase 可能已更新为 review）
              const updated = await fetchBuilderSession(savedId)
              set({ session: updated, generating: false })
              await get().loadPreview()
              return
            } else if (genStatus.status === 'running') {
              // 生成进行中 → 恢复轮询
              set({ generating: true, generationStatus: genStatus })
              _pollGeneration(session.session_id, set, get)
              return
            }
            // failed → 显示错误，让用户点击"重新生成"
            if (genStatus.error) {
              set({ error: genStatus.error })
            }
          } catch {
            // 后端重启等原因无法获取状态 → 用户可手动重试
          }
          return
        }

        // ── review / calibration / finalized / deployed → 加载预览 ──
        if (['review', 'calibration', 'finalized', 'deployed'].includes(session.phase)) {
          await get().loadPreview()
        }
        return
      } catch {
        // 会话已过期或不存在，清除并创建新会话
        localStorage.removeItem(SESSION_KEY)
      }
    }
    // 无已有会话，创建新的
    await get().startSession()
  },

  startSession: async (templateId?: string) => {
    set({ loading: true, error: null })
    try {
      const { session, first_question, ui_type, ui_data } = await createBuilderSession(templateId)
      localStorage.setItem(SESSION_KEY, session.session_id)
      set({
        session,
        messages: [{
          role: 'assistant',
          content: first_question,
          timestamp: new Date().toISOString(),
          ui_type: ui_type || 'text',
          ui_data: ui_data || {},
        }],
        loading: false,
        intakeCompleted: false,
        currentUIType: ui_type || 'text',
        currentUIData: ui_data || {},
      })
    } catch (e: any) {
      set({ loading: false, error: e.message || '创建会话失败' })
    }
  },

  loadSession: async (sessionId) => {
    set({ loading: true, error: null })
    try {
      const session = await fetchBuilderSession(sessionId)
      localStorage.setItem(SESSION_KEY, session.session_id)
      set({
        session,
        messages: [],
        loading: false,
        intakeCompleted: session.phase !== 'intake',
      })
    } catch (e: any) {
      set({ loading: false, error: e.message || '加载会话失败' })
    }
  },

  /** 发送文本输入 */
  sendIntake: async (input) => {
    const { session } = get()
    if (!session) return

    const userMsg: IntakeMessage = { role: 'user', content: input, timestamp: new Date().toISOString() }
    set(state => ({
      messages: [...state.messages, userMsg],
      responding: true,
      error: null,
    }))

    try {
      const { session: updated, response, completed, ui_type, ui_data } = await submitIntake(session.session_id, input)
      const assistantMsg: IntakeMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        ui_type: ui_type || 'text',
        ui_data: ui_data || {},
      }
      set(state => ({
        session: updated,
        messages: [...state.messages, assistantMsg],
        responding: false,
        intakeCompleted: completed,
        currentUIType: ui_type || 'text',
        currentUIData: ui_data || {},
      }))
    } catch (e: any) {
      set(state => ({
        responding: false,
        error: e.message || '处理失败',
        messages: [...state.messages, {
          role: 'assistant' as const,
          content: '抱歉，处理失败，请重试。',
          timestamp: new Date().toISOString(),
        }],
      }))
    }
  },

  /** 发送结构化选择（行业 / 角色 / 工作流） */
  sendIntakeSelection: async (selectionType, selectionData) => {
    const { session } = get()
    if (!session) return

    // 添加用户摘要消息
    let userContent = ''
    if (selectionType === 'industry_select') {
      userContent = `选择行业: ${(selectionData as any).industry_id || '自定义'}`
    } else if (selectionType === 'role_select') {
      const names = ((selectionData as any).selected_roles || [])
        .filter((r: any) => r.checked)
        .map((r: any) => r.name)
      userContent = `确认角色: ${names.join('、') || '(无)'}`
    } else if (selectionType === 'workflow_select') {
      const names = ((selectionData as any).selected_workflows || [])
        .filter((w: any) => w.checked)
        .map((w: any) => w.name)
      userContent = `确认工作流: ${names.join('、') || '(无)'}`
    }

    const userMsg: IntakeMessage = {
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    }
    set(state => ({
      messages: [...state.messages, userMsg],
      responding: true,
      error: null,
    }))

    try {
      const { session: updated, response, completed, ui_type, ui_data } =
        await submitIntakeSelection(session.session_id, selectionType, selectionData)
      const assistantMsg: IntakeMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        ui_type: ui_type || 'text',
        ui_data: ui_data || {},
      }
      set(state => ({
        session: updated,
        messages: [...state.messages, assistantMsg],
        responding: false,
        intakeCompleted: completed,
        currentUIType: ui_type || 'text',
        currentUIData: ui_data || {},
      }))
    } catch (e: any) {
      set(state => ({
        responding: false,
        error: e.message || '处理选择失败',
        messages: [...state.messages, {
          role: 'assistant' as const,
          content: '抱歉，处理选择失败，请重试。',
          timestamp: new Date().toISOString(),
        }],
      }))
    }
  },

  refreshIntakeStatus: async () => {
    const { session } = get()
    if (!session) return
    try {
      const status = await fetchIntakeStatus(session.session_id)
      set({ intakeStatus: status })
    } catch {
      // silent
    }
  },

  /** 异步生成 + 轮询进度 */
  triggerGenerate: async () => {
    const { session } = get()
    if (!session) return

    set({ generating: true, error: null, generationStatus: null })
    try {
      // 启动异步生成（202 立即返回）
      const initial = await startGeneration(session.session_id)
      set({ generationStatus: initial })
      // 启动轮询（复用提取的 helper）
      _pollGeneration(session.session_id, set, get)
    } catch (e: any) {
      set({ generating: false, error: e.message || '启动生成失败' })
    }
  },

  loadPreview: async () => {
    const { session } = get()
    if (!session) return
    try {
      const preview = await fetchProfilePreview(session.session_id)
      set({ preview, issues: preview.validation_issues })
    } catch (e: any) {
      set({ error: e.message || '加载预览失败，请重试' })
    }
  },

  loadSuggestedCases: async () => {
    const { session } = get()
    if (!session) return
    try {
      const { cases } = await fetchSuggestedCases(session.session_id)
      set({ suggestedCases: cases })
    } catch {
      // 加载建议用例失败不阻断流程
    }
  },

  runCalibration: async (cases) => {
    const { session } = get()
    if (!session) return

    set({ calibrating: true, error: null })
    try {
      const { session: updated, report } = await submitCalibration(session.session_id, cases)
      set({ session: updated, calibrationReport: report, calibrating: false })
    } catch (e: any) {
      set({ calibrating: false, error: e.message || '校准失败' })
    }
  },

  /** 切换阶段（支持前进和返回） */
  goToPhase: async (phase) => {
    set(state => ({
      session: state.session ? { ...state.session, phase } : null,
      error: null,
    }))
    // 如果返回 review，重新加载预览（可能有修改）
    if (phase === 'review') {
      await get().loadPreview()
    }
  },

  triggerFinalize: async () => {
    const { session } = get()
    if (!session) return

    set({ exporting: true, error: null })
    try {
      const { summary } = await finalizeProfile(session.session_id)
      set(state => ({
        session: state.session ? { ...state.session, phase: 'finalized' } : null,
        exportSummary: summary,
        exporting: false,
      }))
    } catch (e: any) {
      set({ exporting: false, error: e.message || '定稿失败' })
    }
  },

  triggerDeploy: async () => {
    const { session } = get()
    if (!session) return

    set({ exporting: true, error: null })
    try {
      const result = await deployProfile(session.session_id)
      if (result.deployed) {
        set(state => ({
          session: state.session ? { ...state.session, phase: 'deployed' } : null,
          deployed: true,
          exporting: false,
          error: null,
        }))
      } else {
        // 部署返回成功但 deployed=false，显示错误原因
        set({
          exporting: false,
          error: result.message || '部署失败，请检查配置文件格式',
        })
      }
    } catch (e: any) {
      set({ exporting: false, error: e.message || '部署失败' })
    }
  },

  reset: () => {
    localStorage.removeItem(SESSION_KEY)
    set(INITIAL_STATE)
  },
}))
