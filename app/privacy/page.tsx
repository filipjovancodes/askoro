import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>

          <Card className="p-8 border-border space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Privacy at AskOro</h2>
              <p className="text-muted-foreground">
                We take your privacy seriously. This page outlines how we collect, use, and protect your data.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Data Protection</h3>
              <p className="text-muted-foreground">
                Your data is encrypted and stored securely. We never share personal information with third parties
                without your consent.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Your Rights</h3>
              <p className="text-muted-foreground">
                You have the right to access, modify, or delete your data at any time. Contact us for any
                privacy-related requests.
              </p>
            </div>
          </Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}
