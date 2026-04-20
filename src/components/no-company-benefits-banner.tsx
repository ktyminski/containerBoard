import Link from "next/link";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";

type NoCompanyBenefitsBannerProps = {
  className?: string;
  ctaHref?: string;
  ctaLabel?: string;
  messages: ContainerModuleMessages["banner"];
};

export function NoCompanyBenefitsBanner({
  className,
  ctaHref = "/companies/new",
  ctaLabel,
  messages,
}: NoCompanyBenefitsBannerProps) {
  return (
    <div
      className={`rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-amber-900 shadow-sm ${
        className ?? ""
      }`.trim()}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{messages.recommendation}</span>{" "}
          {messages.description} <strong>{messages.highlight}</strong>
        </p>
        <Link
          href={ctaHref}
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-md border border-amber-500 bg-amber-100 px-3 text-sm font-medium text-amber-900 transition hover:bg-amber-200"
        >
          {ctaLabel ?? messages.cta}
        </Link>
      </div>
    </div>
  );
}
