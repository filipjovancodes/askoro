import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function DemoPage() {
  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 border-border">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Schedule a demo</h1>
                <p className="text-muted-foreground">See Oro in action with a personalized walkthrough</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">First name</label>
                    <Input type="text" placeholder="John" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Last name</label>
                    <Input type="text" placeholder="Doe" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <Input type="email" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Company</label>
                  <Input type="text" placeholder="Your company" />
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90">Schedule demo</Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
