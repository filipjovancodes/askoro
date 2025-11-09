import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check } from "lucide-react"

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      price: "$99",
      period: "/month",
      description: "Perfect for small teams getting started",
      features: [
        "Up to 5 team members",
        "Basic knowledge base integration",
        "Slack integration",
        "Community support",
        "5GB storage",
      ],
    },
    {
      name: "Professional",
      price: "$299",
      period: "/month",
      description: "For growing teams with more knowledge",
      popular: true,
      features: [
        "Up to 50 team members",
        "Advanced knowledge base features",
        "Slack + future integrations",
        "Priority support",
        "100GB storage",
        "Custom training",
        "Team analytics",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with custom needs",
      features: [
        "Unlimited team members",
        "Full API access",
        "White-label options",
        "Dedicated support",
        "Unlimited storage",
        "Custom integrations",
        "SLA guarantees",
      ],
    },
  ]

  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-5xl font-bold">Simple, transparent pricing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your team. All plans include our core AI knowledge search.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`p-8 border-border flex flex-col ${
                  plan.popular ? "md:scale-105 border-primary/50 shadow-lg" : ""
                }`}
              >
                {plan.popular && (
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <Button
                  className={`w-full mb-8 ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.price === "Custom" ? "Contact sales" : "Get started"}
                </Button>
                <div className="space-y-4 flex-1">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground">
              Questions about pricing?{" "}
              <a href="#" className="text-primary hover:underline">
                Contact our team
              </a>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
