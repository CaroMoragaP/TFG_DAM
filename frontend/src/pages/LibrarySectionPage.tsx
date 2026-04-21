type LibrarySectionPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function LibrarySectionPage({
  eyebrow,
  title,
  description,
}: LibrarySectionPageProps) {
  return (
    <section className="content-stack">
      <div className="panel">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
