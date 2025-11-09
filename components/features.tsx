import { Card } from "@/components/ui/card"
import { BookOpen, Zap, Shield } from "lucide-react"

export function Features() {
  const features = [
    {
      icon: BookOpen,
      title: "Unified Knowledge Base",
      description: "Connects all your documentation, wikis, and resources in one intelligent search",
    },
    {
      icon: Zap,
      title: "Instant AI Answers",
      description: "Get accurate responses powered by your actual company knowledge, always up-to-date",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "SOC 2, GDPR compliant, zero data retention",
    },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-bold">Powerful features built for teams</h2>
          <p className="text-lg text-muted-foreground">Everything you need to turn knowledge into action</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Card key={i} className="p-6 border-border hover:border-primary/50 transition cursor-pointer group">
              <feature.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition" />
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
