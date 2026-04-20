type StaticRichSection = {
  title: string;
  paragraphs?: ReadonlyArray<string>;
  items?: ReadonlyArray<string>;
  outro?: string;
  subsections?: ReadonlyArray<{
    title: string;
    paragraphs?: ReadonlyArray<string>;
    items?: ReadonlyArray<string>;
    outro?: string;
  }>;
};

type StaticRichSectionsProps = {
  sections: ReadonlyArray<StaticRichSection>;
};

function SectionBody({
  paragraphs,
  items,
  outro,
}: {
  paragraphs?: ReadonlyArray<string>;
  items?: ReadonlyArray<string>;
  outro?: string;
}) {
  return (
    <>
      {paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {items && items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {outro ? <p>{outro}</p> : null}
    </>
  );
}

export function StaticRichSections({ sections }: StaticRichSectionsProps) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-100">{section.title}</h2>
          <SectionBody
            paragraphs={section.paragraphs}
            items={section.items}
            outro={section.outro}
          />
          {section.subsections?.map((subsection) => (
            <div key={subsection.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-200">{subsection.title}</h3>
              <SectionBody
                paragraphs={subsection.paragraphs}
                items={subsection.items}
                outro={subsection.outro}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
