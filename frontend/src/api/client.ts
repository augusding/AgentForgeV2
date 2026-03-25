import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── P2 Task 6B: POST 请求去重 ────────────────────────────
const inflightRequests = new Map<string, Promise<any>>()

function makeDedupeKey(config: AxiosRequestConfig): string | null {
  const method = config.method?.toUpperCase()
  if (method !== 'POST') return null
  // 排除文件上传（FormData 无法序列化）
  if (config.data instanceof FormData) return null
  return `${method}:${config.url}:${JSON.stringify(config.data || '')}`
}

// ── 网络错误去重：同一条消息 10 秒内只 toast 一次 ──────────
let _lastNetworkToastTime = 0
const NETWORK_TOAST_DEBOUNCE_MS = 10_000

function showDebouncedNetworkError() {
  const now = Date.now()
  if (now - _lastNetworkToastTime > NETWORK_TOAST_DEBOUNCE_MS) {
    _lastNetworkToastTime = now
    toast.error('服务器连接失败，请检查网络或稍后重试')
  }
}

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // JWT token as Bearer backup (httpOnly cookie is primary)
  const token = localStorage.getItem('agentforge_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // FormData: let browser auto-set Content-Type with boundary
  if (config.data instanceof FormData) {
    config.headers['Content-Type'] = undefined as any
  }
  return config
})

client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config as any

    // P2 Task 6A: 429 自动重试（最多 2 次）
    if (error.response?.status === 429 && config) {
      config._retryCount = (config._retryCount || 0) + 1
      if (config._retryCount <= 2) {
        const retryAfter = parseInt(error.response.headers?.['retry-after'] || '2', 10)
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 10) * 1000))
        return client.request(config)
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.detail ||
      error.message ||
      'Request failed'

    // _silent 标记的请求不弹 toast（用于轮询、后台刷新等）
    const isSilent = config?._silent === true

    // 401 → redirect to login (don't toast)
    // Skip redirect for auth check (/auth/me) — let the auth store handle it gracefully
    if (error.response?.status === 401) {
      localStorage.removeItem('agentforge_token')
      const requestUrl = config?.url || ''
      const isAuthCheck = requestUrl.includes('/auth/me')
      if (!isAuthCheck && window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login'
      }
    } else if (!isSilent && error.response?.status !== 429) {
      // 网络错误（无 response）→ 去重显示一次
      if (!error.response) {
        showDebouncedNetworkError()
      } else {
        toast.error(message)
      }
    }

    return Promise.reject({
      code: error.response?.data?.error?.code,
      message,
      status: error.response?.status,
    })
  },
)

/**
 * P2 Task 6B: 带去重的 POST 请求包装。
 * 对相同 method+url+body 的并发请求只发一次。
 */
export function dedupePost<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const key = `POST:${url}:${JSON.stringify(data || '')}`
  const inflight = inflightRequests.get(key)
  if (inflight) return inflight as Promise<T>

  const promise = client.post<any, T>(url, data, config).finally(() => {
    inflightRequests.delete(key)
  })
  inflightRequests.set(key, promise)
  return promise
}

export default client
