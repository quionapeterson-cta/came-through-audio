import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { isShareId, shareCardImage } from "@/lib/share-cards";

const TITLE = "Made with Came Through Audio";
const DESCRIPTION = "YOUR FIRST STOP BEFORE DISTRIBUTION. Embed your metadata and organize your music business like a pro.";

/**
 * Public page behind every shared teaser card. Social sites read its og:image (the card) for link previews.
 * It is exempt from the staging gate in __root.tsx and allowed in robots.txt, and shows nothing but the card.
 */
export const Route = createFileRoute("/share/$owner/$card")({
  loader: ({ params }) => {
    if (!isShareId(params.owner) || !isShareId(params.card)) throw notFound();
    return { image: shareCardImage(params.owner, params.card) };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: loaderData.image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1080" },
      { property: "og:image:height", content: "1080" },
      { property: "og:image:alt", content: "Teaser card made with Came Through Audio" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: loaderData.image },
    ] : [],
  }),
  component: SharePage,
});

function SharePage() {
  const { image } = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col bg-ink text-ink-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6"><BrandLogo /></header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-4 py-10 text-center sm:px-6">
        <img src={image} alt="Teaser card made with Came Through Audio" className="w-full max-w-md rounded-2xl border border-ink-border shadow-2xl" />
        <div>
          <p className="text-lg font-extrabold uppercase tracking-[2px]">Your first stop before distribution</p>
          <p className="mt-2 text-ink-muted">Embed your metadata and organize your music business like a pro.</p>
        </div>
        <Link to="/" hash="signup" className="inline-flex h-12 items-center rounded-md bg-primary px-8 font-semibold text-primary-foreground hover:bg-primary/90">Sign up free</Link>
      </main>
    </div>
  );
}
