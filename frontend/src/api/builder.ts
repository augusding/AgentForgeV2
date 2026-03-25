/**
 * Profile Builder API
 */
import client from './client'
import type {
  BuilderSession, IntakeStatus, IntakeResponse, IntakeUIType, IntakeUIData,
  ProfilePreviewData, ValidationIssue, GenerationStatus,
  CalibrationCase, CalibrationReport, ExportSummary,
} from '../types/builder'

// ── Session APIs ──────────────────────────────────────

export interface CreateSessionResult {
  session: BuilderSession
  first_question: string
  ui_type: IntakeUIType
  ui_data: IntakeUIData
}

export async function createBuilderSession(templateId?: string): Promise<CreateSessionResult> {
  return client.post('/builder/sessions', templateId ? { template_id: templateId } : undefined)
}

export async function fetchBuilderSession(sessionId: string): Promise<BuilderSession> {
  return client.get(`/builder/sessions/${sessionId}`)
}

export async function fetchBuilderSessions(): Promise<BuilderSession[]> {
  return client.get('/builder/sessions')
}

// ── Intake APIs ───────────────────────────────────────

/** 文本输入 */
export async function submitIntake(
  sessionId: string,
  userInput: string,
): Promise<IntakeResponse> {
  return client.post(`/builder/sessions/${sessionId}/intake`, { user_input: userInput }, {
    timeout: 120000,  // 2 分钟超时 — 含 LLM 提取+问题生成，tier fallback 可能较慢
  })
}

/** 结构化选择输入（行业选择、角色勾选、工作流勾选） */
export async function submitIntakeSelection(
  sessionId: string,
  selectionType: IntakeUIType,
  selectionData: Record<string, unknown>,
): Promise<IntakeResponse> {
  return client.post(`/builder/sessions/${sessionId}/intake`, {
    selection_type: selectionType,
    selection_data: selectionData,
  }, {
    timeout: 120000,  // 2 分钟超时
  })
}

export async function fetchIntakeStatus(sessionId: string): Promise<IntakeStatus> {
  return client.get(`/builder/sessions/${sessionId}/intake/status`, { _silent: true } as any)
}

export async function uploadIntakeDocs(
  sessionId: string,
  files: File[],
): Promise<{ message: string }> {
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))
  return client.post(`/builder/sessions/${sessionId}/intake/docs`, formData, {
    headers: { 'Content-Type': undefined },
  })
}

// ── Generation APIs ───────────────────────────────────

/** 启动异步生成（立即返回 202） */
export async function startGeneration(sessionId: string): Promise<GenerationStatus> {
  return client.post(`/builder/sessions/${sessionId}/generate`, undefined, {
    timeout: 30000,  // 仅启动，应该很快
  })
}

/** 轮询生成状态 */
export async function fetchGenerationStatus(sessionId: string): Promise<GenerationStatus> {
  return client.get(`/builder/sessions/${sessionId}/generate/status`, { _silent: true } as any)
}

/** 保留旧接口，作为 fallback（同步生成） */
export async function generateProfile(
  sessionId: string,
): Promise<{ session: BuilderSession; issues: ValidationIssue[] }> {
  return client.post(`/builder/sessions/${sessionId}/generate`, undefined, {
    timeout: 600000,  // 10 分钟超时 — 生成涉及多次并行 LLM 调用
  })
}

export async function fetchProfilePreview(sessionId: string): Promise<ProfilePreviewData> {
  return client.get(`/builder/sessions/${sessionId}/preview`, {
    timeout: 60000,  // 1 分钟超时
  })
}

export async function updateAgent(
  sessionId: string,
  agentId: string,
  yamlContent: string,
): Promise<{ success: boolean }> {
  return client.put(`/builder/sessions/${sessionId}/profile/agents/${agentId}`, { yaml: yamlContent })
}

export async function regenerateAgent(
  sessionId: string,
  agentId: string,
  instruction?: string,
): Promise<{ success: boolean; agent_id: string; yaml: string }> {
  return client.post(
    `/builder/sessions/${sessionId}/profile/agents/${agentId}/regenerate`,
    instruction ? { instruction } : {},
  )
}

// ── Calibration APIs ──────────────────────────────────

export async function submitCalibration(
  sessionId: string,
  cases: Omit<CalibrationCase, 'id'>[],
): Promise<{ session: BuilderSession; report: CalibrationReport }> {
  return client.post(`/builder/sessions/${sessionId}/calibrate`, { cases }, {
    timeout: 300000,  // 5 分钟超时 — 校准涉及多次 LLM 模拟执行
  })
}

export async function fetchCalibrationResults(
  sessionId: string,
): Promise<CalibrationReport> {
  return client.get(`/builder/sessions/${sessionId}/calibrate/results`)
}

/** 获取基于当前业务的推荐校准用例 */
export interface SuggestedCase {
  instruction: string
  expected_behavior: string
  expected_output_keywords: string
  source: 'workflow' | 'role' | 'industry'
}

export async function fetchSuggestedCases(
  sessionId: string,
): Promise<{ cases: SuggestedCase[] }> {
  return client.get(`/builder/sessions/${sessionId}/calibrate/suggestions`)
}

// ── Finalize & Deploy APIs ────────────────────────────

export async function finalizeProfile(
  sessionId: string,
): Promise<{ output_path: string; summary: ExportSummary }> {
  return client.post(`/builder/sessions/${sessionId}/finalize`)
}

export async function deployProfile(
  sessionId: string,
): Promise<{ deployed: boolean; profile_dir: string; message: string }> {
  return client.post(`/builder/sessions/${sessionId}/deploy`)
}

export async function exportProfileZip(sessionId: string): Promise<Blob> {
  const res = await client.get(`/builder/sessions/${sessionId}/export`, { responseType: 'blob' })
  return res as unknown as Blob
}
