import PageHeader from '../../components/PageHeader'
import AIEfficiency from './AIEfficiency'

export default function Dashboard() {
  return (
    <div>
      <PageHeader title="仪表盘" description="AI 效能分析与质量统计" />
      <AIEfficiency />
    </div>
  )
}
