import { useState } from 'react'
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

interface Props {
  src: string
  filename: string
  onClose: () => void
}

export default function ImageLightbox({ src, filename, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleDownload = () => {
    const token = localStorage.getItem('agentforge_token') || ''
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2 z-10" onClick={e => e.stopPropagation()}>
        <button onClick={() => setScale(s => Math.min(s + 0.25, 3))}
          className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}><ZoomIn size={18} /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.25, 0.25))}
          className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}><ZoomOut size={18} /></button>
        <button onClick={() => setRotation(r => r + 90)}
          className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}><RotateCw size={18} /></button>
        <button onClick={handleDownload}
          className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}><Download size={18} /></button>
        <button onClick={onClose}
          className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}><X size={18} /></button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.6)', color: '#ccc' }}>{filename}</div>
      <img src={src} alt={filename} onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
          transform: `scale(${scale}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }} />
    </div>
  )
}
