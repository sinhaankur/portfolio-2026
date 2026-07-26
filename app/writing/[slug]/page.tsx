import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import { SHORT_POSTS, getShortPost } from "@/lib/writing-posts"

// Static export: pre-render every short post. The hand-built long-form posts
// (e.g. /writing/universe-engine) live on their own routes and are excluded here.
export function generateStaticParams() {
  return SHORT_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getShortPost(slug)
  if (!post) return {}
  return {
    ...canonicalPath(`/writing/${post.slug}`),
    title: post.title,
    description: post.blurb,
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

export default async function ShortPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getShortPost(slug)
  if (!post) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <Link
        href="/writing"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        Writing
      </Link>

      <article>
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">
          {fmtDate(post.date)}
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
          {post.title}
        </h1>
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-4">
          {post.lead}
        </p>

        {post.sections.map((s, i) => (
          <section key={i}>
            {s.heading && (
              <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">
                {s.heading}
              </h2>
            )}
            <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">
              {s.body}
            </p>
          </section>
        ))}

        {post.live && (
          <p className="mt-12 border-t border-border/60 pt-6 font-sans text-[15px] text-foreground/70">
            See it live:{" "}
            <Link href={post.live.href} className="text-accent hover:underline">
              {post.live.label}
            </Link>
            .
          </p>
        )}
      </article>
    </main>
  )
}
