import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>

          <Card className="p-8 border-border space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Terms & Conditions</h2>
              <p className="text-muted-foreground">
                These terms govern your use of AskOro. By using our service, you agree to these terms.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Use License</h3>
              <p className="text-muted-foreground">
                You are granted a limited, non-exclusive license to use AskOro for lawful purposes only.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Acceptable Use</h3>
              <p className="text-muted-foreground">
                You agree not to use AskOro for illegal activities or to violate the rights of others.
              </p>
            </div>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
