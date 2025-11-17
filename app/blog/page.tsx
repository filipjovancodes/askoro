import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Calendar, ArrowRight } from "lucide-react"

type BlogPost = {
  id: string
  title: string
  excerpt: string
  date: string
  author: string
  readTime: string
  category?: string
}

// Sample blog posts - replace with your actual content
const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Introducing AskOro: AI-Powered Knowledge Search for Teams",
    excerpt: "We're excited to launch AskOro, a new way for teams to search and discover information using AI. Learn how we're revolutionizing knowledge discovery.",
    date: "2024-01-15",
    author: "AskOro Team",
    readTime: "5 min read",
    category: "Product",
  },
  {
    id: "2",
    title: "How to Set Up Your First Knowledge Base Integration",
    excerpt: "Getting started with AskOro is easy. Follow this step-by-step guide to connect your first data source and start asking questions.",
    date: "2024-01-10",
    author: "AskOro Team",
    readTime: "8 min read",
    category: "Tutorial",
  },
  {
    id: "3",
    title: "Best Practices for Organizing Your Team's Knowledge",
    excerpt: "Discover strategies for keeping your documentation organized and making it easier for AI to find the right answers when your team needs them.",
    date: "2024-01-05",
    author: "AskOro Team",
    readTime: "6 min read",
    category: "Tips",
  },
]

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function BlogPage() {
  return (
    <main className="bg-background">
      <Navbar />
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl font-bold">Blog</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Insights, tutorials, and updates from the AskOro team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <Card key={post.id} className="p-6 border-border hover:shadow-lg transition-shadow flex flex-col">
                {post.category && (
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {post.category}
                    </span>
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-3 line-clamp-2">{post.title}</h2>
                <p className="text-muted-foreground mb-4 flex-1 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(post.date)}</span>
                  </div>
                  <span>•</span>
                  <span>{post.readTime}</span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">{post.author}</span>
                  <Link
                    href={`/blog/${post.id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Read more
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {blogPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}

