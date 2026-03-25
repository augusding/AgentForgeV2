import axios from 'axios'
import toast from 'react-hot-toast'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('agentforge_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.error || error.response?.data?.message || error.message || '请求失败'

    if (status === 401 && !error.config?.url?.includes('/auth/me')) {
      localStorage.removeItem('agentforge_token')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    } else if (status !== 401) {
      toast.error(message)
    }
    return Promise.reject({ status, message })
  },
)

export default client
