function parseBooleanFlag(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

export function isTransportCompareFeatureEnabled(): boolean {
  const configured = parseBooleanFlag(process.env.FEATURE_TRANSPORT_COMPARE);
  if (configured !== null) {
    return configured;
  }

  return process.env.NODE_ENV !== "production";
}
