import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Shield, Lock, Eye, AlertCircle } from "lucide-react"

export default function SecurityPage() {
  const features = [
    {
      icon: Shield,
      title: "Data Encryption",
      description: "All data is encrypted in transit and at rest using industry-standard protocols",
    },
    {
      icon: Lock,
      title: "Secure Authentication",
      description: "Multi-factor authentication and secure session management",
    },
    {
      icon: Eye,
      title: "Audit Logs",
      description: "Complete audit trails for all data access and changes",
    },
    {
      icon: AlertCircle,
      title: "Compliance",
      description: "Compliant with SOC 2, GDPR, and other enterprise standards",
    },
  ]

  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl font-bold">Security</h1>
            <p className="text-xl text-muted-foreground">Enterprise-grade security to protect your data</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <Card key={i} className="p-6 border-border">
                  <div className="flex gap-4">
                    <Icon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
