import client from './client'

export interface UserInfo {
  id: string
  username: string
  display_name: string
  role: string
  industry: string
  sub_industry: string
  created_at: string
  last_login_at: string | null
}

export async function fetchUsers(): Promise<UserInfo[]> {
  return client.get('/users') as any
}

export async function createUser(data: {
  username: string
  password: string
  display_name?: string
  role?: string
  industry?: string
  sub_industry?: string
}): Promise<UserInfo> {
  return client.post('/users', data) as any
}

export async function updateUser(
  userId: string,
  data: { display_name?: string; role?: string; password?: string; industry?: string; sub_industry?: string },
): Promise<UserInfo> {
  return client.patch(`/users/${userId}`, data) as any
}

export async function deleteUser(userId: string): Promise<void> {
  return client.delete(`/users/${userId}`) as any
}
