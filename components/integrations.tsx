import { Card } from "@/components/ui/card"
import { MessageCircle, Zap, Lock, BarChart3 } from "lucide-react"

export function Integrations() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl sm:text-5xl font-bold text-balance">Oro in your Slack workspace</h2>
          <p className="text-lg text-muted-foreground">
            Meet your knowledge assistant. Ask questions, get answers instantly without leaving Slack.
          </p>
        </div>

        {/* Main feature showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Slack integration hero */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card/50 backdrop-blur p-8 hover:border-primary/50 transition overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Ask Oro in Slack</h3>
                  <p className="text-sm text-muted-foreground mt-1">Search your knowledge base without changing apps</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Type /oro your question directly in any Slack channel</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Get instant, contextual answers from your knowledge base</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Share results directly in the conversation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side features */}
          <div className="space-y-4 flex flex-col">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "Get answers in seconds",
              },
              {
                icon: Lock,
                title: "Secure & Private",
                desc: "Your data stays yours",
              },
              {
                icon: BarChart3,
                title: "Insights Included",
                desc: "See what your team asks",
              },
            ].map((item, i) => (
              <Card key={i} className="p-4 border-border text-center hover:border-primary/50 transition">
                <item.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <h4 className="font-semibold text-sm">{item.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
