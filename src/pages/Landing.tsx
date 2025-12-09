import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
      </div>

      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] py-20 text-center">
        <div className="animate-fade-in max-w-3xl mx-auto">
          {/* Brand */}
          <h1 className="brand-text text-6xl md:text-8xl lg:text-9xl mb-6 tracking-[0.3em]">
            KUBERA
          </h1>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto font-light">
            AI-powered stock analysis assistant for Indian equity investors
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-4 mb-12 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary/50">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>Long & short-term analysis</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary/50">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Portfolio-aware recommendations</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary/50">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Real-time market insights</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button variant="hero" size="xl" className="gap-2 min-w-[200px]">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="hero-outline" size="xl" className="min-w-[200px]">
                Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Smart Analysis"
            description="Get comprehensive fundamental and technical analysis powered by advanced AI models trained on Indian markets."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Portfolio Context"
            description="Recommendations tailored to your risk profile, investment horizon, and existing portfolio holdings."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Real-time Insights"
            description="Stay ahead with instant analysis of market movements, news, and sector trends."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 rounded-lg border border-border bg-card hover:shadow-elevated transition-all duration-300">
      <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
