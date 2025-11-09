import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export function Hero() {
  return (
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium">Introducing AI-powered knowledge search</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-balance">
            Find answers{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">instantly</span>
          </h1>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
            AI-powered knowledge base search that understands context and finds exactly what your team needs. Integrated
            seamlessly into Slack.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2">
                Start free trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline">
                Watch demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
