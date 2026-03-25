import LandingNav from './LandingNav'
import HeroSection from './HeroSection'
import StatsBar from './StatsBar'
import PainPoints from './PainPoints'
import FeatureShowcase from './FeatureShowcase'
import HowItWorks from './HowItWorks'
import PricingTable from './PricingTable'
import Testimonials from './Testimonials'
import CTASection from './CTASection'
import LandingFooter from './LandingFooter'

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0F14] text-white antialiased">
      <LandingNav />
      <HeroSection />
      <StatsBar />
      <PainPoints />
      <FeatureShowcase />
      <HowItWorks />
      <PricingTable />
      <Testimonials />
      <CTASection />
      <LandingFooter />
    </div>
  )
}
