import type { ReactNode } from "react";

type ListLayoutProps = {
  children: ReactNode;
  overlay: ReactNode;
};

export default function ListLayout({ children, overlay }: ListLayoutProps) {
  return (
    <>
      {children}
      {overlay}
    </>
  );
}
