import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl font-bold">About AskOro</h1>
            <p className="text-xl text-muted-foreground">Making knowledge instantly accessible to teams everywhere</p>
          </div>

          <Card className="p-8 border-border space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Our mission</h2>
              <p className="text-muted-foreground">
                We believe every team should have instant access to the knowledge they need. AskOro uses AI to
                revolutionize how teams search and discover information, starting with Slack.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Why we built this</h2>
              <p className="text-muted-foreground">
                Knowledge is scattered across documents, wikis, and conversations. Finding the right answer shouldn't
                require hours of searching. AskOro brings intelligent search to your workflow.
              </p>
            </div>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
