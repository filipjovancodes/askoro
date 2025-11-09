import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border border-primary/20 rounded-2xl p-12 text-center space-y-6">
        <h2 className="text-4xl font-bold">Ready to transform your knowledge?</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Join teams that are already using AI to make knowledge instantly accessible
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2">
              Start free trial <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button size="lg" variant="outline">
              Schedule demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
