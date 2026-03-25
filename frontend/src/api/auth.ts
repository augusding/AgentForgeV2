import client from './client'

/** 发送短信验证码 */
export async function sendSmsCode(phone: string, purpose: string = 'register') {
  return client.post('/auth/send-code', { phone, purpose }) as Promise<{
    success: boolean
    expires_in: number
    message: string
  }>
}

/** 用户注册 */
export async function registerUser(data: {
  username: string
  phone: string
  code: string
  password: string
}) {
  return client.post('/auth/register', data) as Promise<{
    user: {
      id: string
      username: string
      role: string
      plan: string
      trial_expires_at?: string
      trial_remaining_days?: number
    }
    token: string
  }>
}
