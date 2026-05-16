type ContainerSerialNumberOverlayProps = {
  value?: string | null;
};

export function ContainerSerialNumberOverlay({
  value,
}: ContainerSerialNumberOverlayProps) {
  const serialNumber = value?.trim();
  if (!serialNumber) {
    return null;
  }

  return (
    <span
      className="pointer-events-none absolute inset-x-0 top-0 z-10 truncate border-b border-neutral-900/10 bg-white/48 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-neutral-950 shadow-sm backdrop-blur-sm"
      title={serialNumber}
    >
      {serialNumber}
    </span>
  );
}
