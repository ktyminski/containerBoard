"use client";

import { Children, type ReactNode, useState } from "react";

type ShowMoreItemsProps = {
  children: ReactNode;
  showMoreLabel: string;
  initialVisible?: number;
  className?: string;
  buttonClassName?: string;
};

const DEFAULT_INITIAL_VISIBLE = 3;

export function ShowMoreItems({
  children,
  showMoreLabel,
  initialVisible = DEFAULT_INITIAL_VISIBLE,
  className,
  buttonClassName,
}: ShowMoreItemsProps) {
  const [showAll, setShowAll] = useState(false);
  const items = Children.toArray(children);
  const hiddenCount = Math.max(0, items.length - initialVisible);
  const visibleItems = showAll ? items : items.slice(0, initialVisible);

  return (
    <div className={className}>
      {visibleItems}
      {!showAll && hiddenCount > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className={
              buttonClassName ??
              "inline-flex cursor-pointer rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500"
            }
            onClick={() => setShowAll(true)}
          >
            {showMoreLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

