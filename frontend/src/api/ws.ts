export type WSMessageType =
  | 'agent_message'
  | 'mission_progress'
  | 'approval_required'
  | 'token_update'
  | 'agent_status'
  | 'mission_complete'
  | 'heartbeat_result'
  | 'quality_gate'
  | 'blackboard_update'
  | 'dag_node_update'
  | 'error'

export interface WSMessage {
  type: WSMessageType
  data: Record<string, unknown>
}

type MessageHandler = (data: Record<string, unknown>) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private isManualClose = false
  private handlers = new Map<string, Set<MessageHandler>>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(url: string) {
    this.url = url
    this.reconnectInterval = 3000
    this.maxReconnectAttempts = 10
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.startHeartbeat()
        this.emit('_connected', {})
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          this.emit(msg.type, msg.data)
        } catch {
          // ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        this.emit('_disconnected', {})

        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => this.connect(), this.reconnectInterval)
        }
      }

      this.ws.onerror = () => {
        // onclose will fire after onerror
      }
    } catch {
      // connection failed, onclose handler will retry
    }
  }

  disconnect() {
    this.isManualClose = true
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
  }

  send(type: string, data: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.off(type, handler)
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler)
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private emit(type: string, data: Record<string, unknown>) {
    this.handlers.get(type)?.forEach((h) => h(data))
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send('heartbeat')
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`
export const wsClient = new WebSocketClient(wsUrl)
export default wsClient
