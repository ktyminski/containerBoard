function normalizePart(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toCityCountryLocationLabel(input: {
  city?: string | null;
  country?: string | null;
  fallbackLabel?: string | null;
}): string {
  const city = normalizePart(input.city);
  const country = normalizePart(input.country);

  if (city && country) {
    return city.toLowerCase() === country.toLowerCase() ? city : `${city}, ${country}`;
  }
  if (city) {
    return city;
  }
  if (country) {
    return country;
  }

  return normalizePart(input.fallbackLabel) ?? "";
}
