export interface SkillPack {
  id: string
  name: string
  display_name: string
  description: string
  category: string
  icon: string
  color: string
  trigger_patterns: string[]
  guidance: string
  tools_required: string[]
  recommended_positions: string[]
  status: 'draft' | 'review' | 'active' | 'suspended' | 'deprecated' | 'rejected'
  source: 'preset' | 'learned' | 'user_created'
  security_level: 'safe' | 'standard' | 'elevated'
  author_id: string
  version: string
  used_count: number
  avg_satisfaction: number
  is_system: boolean
  org_id: string
  created_at: string
  updated_at: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
}

export interface SkillAssignment {
  id: string
  skill_pack_id: string
  target_type: string
  target_id: string
  enabled: boolean
  assigned_by: string
  created_at: string
}

export interface SkillAudit {
  id: string
  skill_id: string
  action: string
  actor_id: string
  detail: string
  created_at: string
}
