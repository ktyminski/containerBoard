import Link from "next/link";

type NoCompanyBenefitsBannerProps = {
  className?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function NoCompanyBenefitsBanner({
  className,
  ctaHref = "/companies/new",
  ctaLabel = "Zaloz firme",
}: NoCompanyBenefitsBannerProps) {
  return (
    <div
      className={`rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-amber-900 shadow-sm ${
        className ?? ""
      }`.trim()}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Nasza rekomendacja:</span> zaloz firme i
          odblokuj benefity: automatyczne wstawianie lokalizacji, Multi Import,
          lepsza prezentacja ogloszen i szybsze publikowanie.{" "}
          <strong>Zajmie Ci to mniej niz minute.</strong>
        </p>
        <Link
          href={ctaHref}
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-md border border-amber-500 bg-amber-100 px-3 text-sm font-medium text-amber-900 transition hover:bg-amber-200"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
