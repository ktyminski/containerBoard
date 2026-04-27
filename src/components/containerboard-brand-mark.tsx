type ContainerboardBrandMarkProps = {
  className?: string;
};

export function ContainerboardBrandMark({
  className = "h-7 w-auto",
}: ContainerboardBrandMarkProps) {
  return (
    <svg
      viewBox="0 0 102 64"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="5,15 38,2 38,58 5,58" fill="#f8fbff" />
      <polygon points="42,2 97,18 97,58 42,58" fill="#38bdf8" />
      <rect x="39.5" y="1" width="2.5" height="57" fill="#e2efff" />

      <rect x="10.5" y="11" width="2.8" height="42" rx="1.2" fill="#05244f" />
      <rect x="20" y="8" width="2.8" height="45" rx="1.2" fill="#05244f" />
      <rect x="29.5" y="5" width="2.8" height="48" rx="1.2" fill="#05244f" />
      <rect x="7.5" y="18" width="9" height="2.5" rx="1.2" fill="#05244f" />
      <rect x="6.5" y="33" width="10" height="2.5" rx="1.2" fill="#05244f" />
      <rect x="5.5" y="49.5" width="11" height="2.5" rx="1.2" fill="#05244f" />
      <rect x="27" y="12" width="8.5" height="2.5" rx="1.2" fill="#05244f" />
      <rect x="28" y="27" width="8.5" height="2.5" rx="1.2" fill="#05244f" />
      <rect x="29" y="43.5" width="8.5" height="2.5" rx="1.2" fill="#05244f" />
      <circle cx="14.2" cy="44.5" r="1.9" fill="#05244f" />
      <circle cx="27.2" cy="42" r="1.9" fill="#05244f" />
      <rect x="13.6" y="43.8" width="12.9" height="1.5" rx="0.75" fill="#05244f" />

      <rect x="51" y="9" width="2.8" height="45" rx="1.2" fill="#ffffff" />
      <rect x="61.5" y="12" width="2.8" height="42" rx="1.2" fill="#ffffff" />
      <rect x="72" y="15" width="2.8" height="39" rx="1.2" fill="#ffffff" />
      <rect x="82.5" y="18" width="2.8" height="36" rx="1.2" fill="#ffffff" />
      <rect x="91" y="20.5" width="2.8" height="33.5" rx="1.2" fill="#ffffff" />
    </svg>
  );
}
