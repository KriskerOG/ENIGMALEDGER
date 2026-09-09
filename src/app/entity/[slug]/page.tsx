import Link from "next/link";
import { notFound } from "next/navigation";
import { findRecordBySlug, listRecordSlugs } from "@/lib/records";

interface EntityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return listRecordSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: EntityPageProps) {
  const { slug } = await params;
  const record = findRecordBySlug(slug);

  if (!record) {
    return {
      title: "Record Not Found - ENIGMA Verse Index"
    };
  }

  return {
    title: `${record.name} - ENIGMA Verse Index`,
    description: record.summary
  };
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { slug } = await params;
  const record = findRecordBySlug(slug);

  if (!record) {
    notFound();
  }

  return (
    <main className="entity-page">
      <Link className="back-link" href="/">
        返回索引
      </Link>

      <article className="entity-hero">
        <p className="eyebrow">
          {record.categoryLabel ?? record.type.toUpperCase()} - {record.source.sourceName}
        </p>
        <h1>{record.name}</h1>
        {record.nameZh ? <h2>{record.nameZh}</h2> : null}
        <p>{record.summary}</p>

        <div className="source-row">
          <span>{record.source.sourceName}</span>
          {record.source.gameVersion ? <span>{record.source.gameVersion}</span> : null}
          {record.source.sourceUpdatedAt ? <span>Updated {record.source.sourceUpdatedAt}</span> : null}
          <span className={`freshness ${record.source.freshness}`}>{record.source.freshness}</span>
        </div>
      </article>

      <section className="entity-grid">
        <article>
          <h2>Key Stats</h2>
          <div className="detail-stats">
            {Object.entries(record.stats).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value ?? "Unknown"}</strong>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h2>Tags</h2>
          <div className="tag-row">
            {record.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
