import client from './client'
import type { ScenarioData } from '../types/scenario'

export async function fetchScenarios(): Promise<ScenarioData> {
  return client.get('/scenarios')
}
