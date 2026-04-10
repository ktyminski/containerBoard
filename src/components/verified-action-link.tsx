"use client";

import Link from "next/link";
import { useToast } from "@/components/toast-provider";

type VerifiedActionLinkProps = {
  href: string;
  label: string;
  className?: string;
  requiresEmailVerification: boolean;
  blockedMessage: string;
};

export function VerifiedActionLink({
  href,
  label,
  className,
  requiresEmailVerification,
  blockedMessage,
}: VerifiedActionLinkProps) {
  const toast = useToast();

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (!requiresEmailVerification) {
          return;
        }
        event.preventDefault();
        toast.warning(blockedMessage);
      }}
    >
      {label}
    </Link>
  );
}
