import client from './client'

/**
 * Submit human input data for a DAG human_input node.
 */
export async function submitHumanInput(
  missionId: string,
  nodeId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  return client.post(`/human-input/${missionId}/${nodeId}`, { data })
}

/**
 * Cancel human input — skip the node and stop the mission.
 */
export async function cancelHumanInput(
  missionId: string,
  nodeId: string,
): Promise<{ success: boolean; message: string }> {
  return client.post(`/human-input/${missionId}/${nodeId}/cancel`)
}
