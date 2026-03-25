import client from './client'

export async function login(username: string, password: string) {
  return client.post('/auth/login', { username, password }) as Promise<{ token: string; user: any }>
}

export async function register(username: string, password: string, displayName?: string) {
  return client.post('/auth/register', { username, password, display_name: displayName || username }) as Promise<any>
}

export async function getMe() {
  return client.get('/auth/me') as Promise<any>
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return client.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }) as Promise<any>
}

export async function logout() {
  return client.post('/auth/logout') as Promise<any>
}
