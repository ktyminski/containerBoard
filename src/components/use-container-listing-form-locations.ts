"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  UseFormClearErrors,
  UseFormSetValue,
} from "react-hook-form";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";
import {
  MAX_ADDITIONAL_LOCATIONS,
  PRIMARY_LOCATION_MAP_ID,
  buildLocationDisplay,
  buildLocationLabelFromAddressParts,
  createAdditionalLocationDraft,
  parseCoordinate,
  toCoordinateText,
  type AdditionalLocationDraft,
  type AdditionalLocationInitialValue,
  type CompanyLocationPrefillOption,
  type ContainerListingFormValues,
} from "@/components/container-listing-form-shared";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import { formatTemplate, type AppLocale } from "@/lib/i18n";
import { MAX_LISTING_LOCATIONS } from "@/lib/listing-locations";

type GeocodeSearchResponse = {
  item?: {
    lat: number;
    lng: number;
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

type ReverseGeocodeResponse = {
  item?: {
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

type UseContainerListingFormLocationsParams = {
  clearErrors: UseFormClearErrors<ContainerListingFormValues>;
  companyLocationPrefillOptions?: CompanyLocationPrefillOption[];
  initialAdditionalLocations?: AdditionalLocationInitialValue[];
  initialValues?: Partial<ContainerListingFormValues>;
  locale: AppLocale;
  locationAddressCityValue: string;
  locationAddressCountryValue: string;
  locationAddressLabelValue: string;
  locationHouseNumberValue: string;
  locationPostalCodeValue: string;
  locationStreetValue: string;
  lngValue: string;
  latValue: string;
  messages: ContainerModuleMessages;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  onSuccess: (message: string) => void;
  onWarning: (message: string) => void;
  setValue: UseFormSetValue<ContainerListingFormValues>;
};

function buildInitialLocationSearch(
  initialValues?: Partial<ContainerListingFormValues>,
): string {
  return [
    initialValues?.locationAddressLabel,
    initialValues?.locationPostalCode,
    initialValues?.locationAddressCity,
    initialValues?.locationAddressCountry,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

export function useContainerListingFormLocations({
  clearErrors,
  companyLocationPrefillOptions,
  initialAdditionalLocations,
  initialValues,
  locale,
  locationAddressCityValue,
  locationAddressCountryValue,
  locationAddressLabelValue,
  locationHouseNumberValue,
  locationPostalCodeValue,
  locationStreetValue,
  lngValue,
  latValue,
  messages,
  onError,
  onInfo,
  onSuccess,
  onWarning,
  setValue,
}: UseContainerListingFormLocationsParams) {
  const reverseLookupRequestRef = useRef(0);
  const additionalReverseLookupRequestRef = useRef<Record<string, number>>({});
  const [locationSearch, setLocationSearch] = useState(() =>
    buildInitialLocationSearch(initialValues),
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isReverseLookupPending, setIsReverseLookupPending] = useState(false);
  const [additionalLocations, setAdditionalLocations] = useState<
    AdditionalLocationDraft[]
  >(() =>
    (initialAdditionalLocations ?? [])
      .slice(0, MAX_ADDITIONAL_LOCATIONS)
      .map((location) => createAdditionalLocationDraft(location)),
  );
  const [activeMapLocationId, setActiveMapLocationId] = useState<string>(
    PRIMARY_LOCATION_MAP_ID,
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const latNumber = parseCoordinate(latValue);
  const lngNumber = parseCoordinate(lngValue);
  const primaryLocationLabel = (locationAddressLabelValue ?? "").trim();
  const isLocationBusy = isSearchingLocation || isReverseLookupPending;
  const resolvedCompanyLocationPrefillOptions = useMemo(
    () =>
      (companyLocationPrefillOptions ?? []).filter(
        (option) =>
          Number.isFinite(option.locationLat) &&
          Number.isFinite(option.locationLng),
      ),
    [companyLocationPrefillOptions],
  );
  const hasCompanyLocationPrefill =
    resolvedCompanyLocationPrefillOptions.length > 0;
  const primaryLocationDisplay = useMemo(
    () =>
      buildLocationDisplay({
        parts: {
          street: locationStreetValue,
          houseNumber: locationHouseNumberValue,
          postalCode: locationPostalCodeValue,
          city: locationAddressCityValue,
          country: locationAddressCountryValue,
        },
        fallbackLabel: primaryLocationLabel,
      }),
    [
      locationAddressCityValue,
      locationAddressCountryValue,
      locationHouseNumberValue,
      locationPostalCodeValue,
      locationStreetValue,
      primaryLocationLabel,
    ],
  );
  const configuredAdditionalLocationsCount = additionalLocations.filter(
    (location) =>
      location.locationLat !== null && location.locationLng !== null,
  ).length;
  const configuredLocationsCount =
    (latNumber !== null && lngNumber !== null ? 1 : 0) +
    configuredAdditionalLocationsCount;
  const configuredLocationDisplays = useMemo(() => {
    const result: Array<{
      key: string;
      postalCode?: string;
      rest: string;
      country?: string;
    }> = [];

    if (latNumber !== null && lngNumber !== null) {
      result.push({
        key: PRIMARY_LOCATION_MAP_ID,
        postalCode: primaryLocationDisplay.postalCode,
        rest: primaryLocationDisplay.rest,
        country: primaryLocationDisplay.country,
      });
    }

    for (const location of additionalLocations) {
      if (location.locationLat === null || location.locationLng === null) {
        continue;
      }
      const display = buildLocationDisplay({
        parts: location.locationAddressParts,
        fallbackLabel: location.locationAddressLabel || location.search,
      });
      result.push({
        key: location.id,
        postalCode: display.postalCode,
        rest: display.rest,
        country: display.country,
      });
    }

    return result;
  }, [additionalLocations, latNumber, lngNumber, primaryLocationDisplay]);
  const visibleConfiguredLocationDisplays = configuredLocationDisplays.slice(
    0,
    3,
  );
  const hiddenConfiguredLocationsCount = Math.max(
    0,
    configuredLocationDisplays.length -
      visibleConfiguredLocationDisplays.length,
  );
  const locationMapPoints = useMemo(
    () => [
      {
        id: PRIMARY_LOCATION_MAP_ID,
        lat: latNumber,
        lng: lngNumber,
        isPrimary: true,
      },
      ...additionalLocations.map((location) => ({
        id: location.id,
        lat: location.locationLat,
        lng: location.locationLng,
        isPrimary: false,
      })),
    ],
    [additionalLocations, latNumber, lngNumber],
  );
  const activeMapLocationLabel = useMemo(() => {
    if (activeMapLocationId === PRIMARY_LOCATION_MAP_ID) {
      return formatTemplate(messages.shared.locationLabelTemplate, {
        index: 1,
      });
    }
    const additionalLocationIndex = additionalLocations.findIndex(
      (location) => location.id === activeMapLocationId,
    );
    if (additionalLocationIndex >= 0) {
      return formatTemplate(messages.shared.locationLabelTemplate, {
        index: additionalLocationIndex + 2,
      });
    }
    return formatTemplate(messages.shared.locationLabelTemplate, { index: 1 });
  }, [
    activeMapLocationId,
    additionalLocations,
    messages.shared.locationLabelTemplate,
  ]);

  useEffect(() => {
    if (activeMapLocationId === PRIMARY_LOCATION_MAP_ID) {
      return;
    }
    const exists = additionalLocations.some(
      (location) => location.id === activeMapLocationId,
    );
    if (!exists) {
      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    }
  }, [activeMapLocationId, additionalLocations]);

  const applyCoordinates = useCallback(
    (nextLat: number, nextLng: number) => {
      setValue("locationLat", toCoordinateText(nextLat), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", toCoordinateText(nextLng), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      clearErrors(["locationLat", "locationLng"]);
    },
    [clearErrors, setValue],
  );

  const applyAddressParts = useCallback(
    (parts?: GeocodeAddressParts | null) => {
      const city = parts?.city?.trim();
      const country = parts?.country?.trim();
      const street = parts?.street?.trim() ?? "";
      const houseNumber = parts?.houseNumber?.trim() ?? "";
      const postalCode = parts?.postalCode?.trim() ?? "";

      setValue("locationStreet", street, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationHouseNumber", houseNumber, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationPostalCode", postalCode, {
        shouldDirty: true,
        shouldTouch: true,
      });

      if (city) {
        setValue("locationAddressCity", city, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      if (country) {
        setValue("locationAddressCountry", country, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    },
    [setValue],
  );

  const fetchSingleGeocodeLocation = useCallback(
    async (
      query: string,
    ): Promise<NonNullable<GeocodeSearchResponse["item"]>> => {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}&lang=${locale}&limit=1`,
      );
      const data = (await response.json()) as GeocodeSearchResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? messages.form.locationFetchError);
      }

      if (!data.item) {
        throw new Error(messages.form.locationNoResults);
      }

      return data.item;
    },
    [locale, messages.form.locationFetchError, messages.form.locationNoResults],
  );

  const handleMapChange = useCallback(
    async (next: { lat: number; lng: number }) => {
      applyCoordinates(next.lat, next.lng);

      const currentRequestId = reverseLookupRequestRef.current + 1;
      reverseLookupRequestRef.current = currentRequestId;
      setIsReverseLookupPending(true);

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(next.lat.toFixed(6))}&lng=${encodeURIComponent(next.lng.toFixed(6))}&lang=${locale}`,
        );
        const data = (await response.json()) as ReverseGeocodeResponse;

        if (reverseLookupRequestRef.current !== currentRequestId) {
          return;
        }

        if (!response.ok || data.error || !data.item) {
          return;
        }

        applyAddressParts(data.item.addressParts);
        if (data.item.shortLabel || data.item.label) {
          const locationLabel = data.item.shortLabel ?? data.item.label;
          setLocationSearch(locationLabel);
          setValue("locationAddressLabel", locationLabel, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }
      } catch {
        // keep coordinates and silently ignore reverse geocode failures
      } finally {
        if (reverseLookupRequestRef.current === currentRequestId) {
          setIsReverseLookupPending(false);
        }
      }
    },
    [applyAddressParts, applyCoordinates, locale, setValue],
  );

  const handleSearchLocation = useCallback(async () => {
    const query = locationSearch.trim();
    if (query.length < 3) {
      onError(messages.form.locationMinChars);
      return;
    }

    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    setIsSearchingLocation(true);

    try {
      const geocodeItem = await fetchSingleGeocodeLocation(query);
      applyCoordinates(geocodeItem.lat, geocodeItem.lng);
      applyAddressParts(geocodeItem.addressParts);
      const locationLabel = geocodeItem.shortLabel ?? geocodeItem.label;
      setLocationSearch(locationLabel);
      setValue("locationAddressLabel", locationLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : messages.form.locationSearchError,
      );
    } finally {
      setIsSearchingLocation(false);
    }
  }, [
    applyAddressParts,
    applyCoordinates,
    fetchSingleGeocodeLocation,
    locationSearch,
    messages.form.locationMinChars,
    messages.form.locationSearchError,
    onError,
    setValue,
  ]);

  const handleAddAdditionalLocation = useCallback(() => {
    if (additionalLocations.length >= MAX_ADDITIONAL_LOCATIONS) {
      onWarning(
        formatTemplate(messages.form.maxLocations, {
          count: MAX_LISTING_LOCATIONS,
        }),
      );
      return;
    }

    const nextLocation = createAdditionalLocationDraft();
    setAdditionalLocations((current) => [...current, nextLocation]);
    setActiveMapLocationId(nextLocation.id);
  }, [additionalLocations.length, messages.form.maxLocations, onWarning]);

  const handleRemoveAdditionalLocation = useCallback(
    (id: string) => {
      delete additionalReverseLookupRequestRef.current[id];
      if (activeMapLocationId === id) {
        setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      }
      setAdditionalLocations((current) =>
        current.filter((location) => location.id !== id),
      );
    },
    [activeMapLocationId],
  );

  const applyPrimaryLocationFromDraft = useCallback(
    (draft: AdditionalLocationDraft) => {
      const nextLat = draft.locationLat;
      const nextLng = draft.locationLng;
      const nextAddressParts = draft.locationAddressParts;
      const nextAddressLabel =
        draft.locationAddressLabel.trim() ||
        buildLocationLabelFromAddressParts(nextAddressParts) ||
        draft.search.trim();

      setValue("locationLat", toCoordinateText(nextLat ?? undefined), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", toCoordinateText(nextLng ?? undefined), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationAddressLabel", nextAddressLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationStreet", nextAddressParts?.street?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue(
        "locationHouseNumber",
        nextAddressParts?.houseNumber?.trim() ?? "",
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
      setValue(
        "locationPostalCode",
        nextAddressParts?.postalCode?.trim() ?? "",
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
      setValue("locationAddressCity", nextAddressParts?.city?.trim() ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue(
        "locationAddressCountry",
        nextAddressParts?.country?.trim() ?? "",
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
      setLocationSearch(nextAddressLabel);

      if (nextLat !== null && nextLng !== null) {
        clearErrors(["locationLat", "locationLng"]);
      }
    },
    [clearErrors, setValue],
  );

  const handleRemovePrimaryLocation = useCallback(() => {
    if (additionalLocations.length === 0) {
      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      setLocationSearch("");
      setValue("locationLat", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationLng", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setValue("locationAddressLabel", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationStreet", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationHouseNumber", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationPostalCode", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCity", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationAddressCountry", "", {
        shouldDirty: true,
        shouldTouch: true,
      });
      clearErrors(["locationLat", "locationLng"]);
      onInfo(formatTemplate(messages.form.locationRemoved, { index: 1 }));
      return;
    }

    const promotedIndex = additionalLocations.findIndex(
      (location) =>
        location.locationLat !== null && location.locationLng !== null,
    );
    const nextPrimaryIndex = promotedIndex >= 0 ? promotedIndex : 0;
    const nextPrimary = additionalLocations[nextPrimaryIndex];
    if (!nextPrimary) {
      return;
    }

    const remainingAdditionalLocations = additionalLocations.filter(
      (_, index) => index !== nextPrimaryIndex,
    );
    applyPrimaryLocationFromDraft(nextPrimary);
    setAdditionalLocations(remainingAdditionalLocations);
    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);

    const nextReverseLookupMap: Record<string, number> = {};
    for (const location of remainingAdditionalLocations) {
      const requestId = additionalReverseLookupRequestRef.current[location.id];
      if (typeof requestId === "number") {
        nextReverseLookupMap[location.id] = requestId;
      }
    }
    additionalReverseLookupRequestRef.current = nextReverseLookupMap;

    onInfo(messages.form.locationPromoted);
  }, [
    additionalLocations,
    applyPrimaryLocationFromDraft,
    clearErrors,
    messages.form.locationPromoted,
    messages.form.locationRemoved,
    onInfo,
    setValue,
  ]);

  const handleUpdateAdditionalLocationSearch = useCallback(
    (id: string, value: string) => {
      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                search: value,
              }
            : location,
        ),
      );
    },
    [],
  );

  const handleSearchAdditionalLocation = useCallback(
    async (id: string) => {
      const target = additionalLocations.find((location) => location.id === id);
      if (!target) {
        return;
      }

      setActiveMapLocationId(id);
      const query = target.search.trim();
      if (query.length < 3) {
        onError(messages.form.locationMinChars);
        return;
      }

      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                isSearching: true,
              }
            : location,
        ),
      );

      try {
        const geocodeItem = await fetchSingleGeocodeLocation(query);
        const locationLabel = geocodeItem.shortLabel ?? geocodeItem.label;

        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  search: locationLabel,
                  isSearching: false,
                  locationLat: geocodeItem.lat,
                  locationLng: geocodeItem.lng,
                  locationAddressLabel: locationLabel,
                  locationAddressParts: geocodeItem.addressParts ?? null,
                }
              : location,
          ),
        );
      } catch (error) {
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  isSearching: false,
                }
              : location,
          ),
        );
        onError(
          error instanceof Error
            ? error.message
            : messages.form.locationSearchError,
        );
      }
    },
    [
      additionalLocations,
      fetchSingleGeocodeLocation,
      messages.form.locationMinChars,
      messages.form.locationSearchError,
      onError,
    ],
  );

  const handleAdditionalLocationMapChange = useCallback(
    async (id: string, next: { lat: number; lng: number }) => {
      const currentRequestId =
        (additionalReverseLookupRequestRef.current[id] ?? 0) + 1;
      additionalReverseLookupRequestRef.current[id] = currentRequestId;

      setAdditionalLocations((current) =>
        current.map((location) =>
          location.id === id
            ? {
                ...location,
                locationLat: next.lat,
                locationLng: next.lng,
                isSearching: true,
              }
            : location,
        ),
      );

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(next.lat.toFixed(6))}&lng=${encodeURIComponent(next.lng.toFixed(6))}&lang=${locale}`,
        );
        const data = (await response.json()) as ReverseGeocodeResponse;

        if (
          additionalReverseLookupRequestRef.current[id] !== currentRequestId
        ) {
          return;
        }

        if (!response.ok || data.error || !data.item) {
          setAdditionalLocations((current) =>
            current.map((location) =>
              location.id === id
                ? {
                    ...location,
                    isSearching: false,
                  }
                : location,
            ),
          );
          return;
        }

        const locationLabel = data.item.shortLabel ?? data.item.label;
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  search: locationLabel,
                  isSearching: false,
                  locationAddressLabel: locationLabel,
                  locationAddressParts: data.item?.addressParts ?? null,
                }
              : location,
          ),
        );
      } catch {
        if (
          additionalReverseLookupRequestRef.current[id] !== currentRequestId
        ) {
          return;
        }
        setAdditionalLocations((current) =>
          current.map((location) =>
            location.id === id
              ? {
                  ...location,
                  isSearching: false,
                }
              : location,
          ),
        );
      }
    },
    [locale],
  );

  const handleSharedMapPointChange = useCallback(
    async (id: string, next: { lat: number; lng: number }) => {
      if (id === PRIMARY_LOCATION_MAP_ID) {
        await handleMapChange(next);
        return;
      }
      await handleAdditionalLocationMapChange(id, next);
    },
    [handleAdditionalLocationMapChange, handleMapChange],
  );

  const handleApplyCompanyLocation = useCallback(
    (selectedOptions?: CompanyLocationPrefillOption[]) => {
      const requestedOptions =
        selectedOptions && selectedOptions.length > 0
          ? selectedOptions
          : resolvedCompanyLocationPrefillOptions.slice(0, 1);
      if (requestedOptions.length === 0) {
        return;
      }

      const normalizedOptions = requestedOptions.filter(
        (option) =>
          Number.isFinite(option.locationLat) &&
          Number.isFinite(option.locationLng),
      );
      if (normalizedOptions.length === 0) {
        return;
      }

      const dedupedOptions: CompanyLocationPrefillOption[] = [];
      const seenKeys = new Set<string>();
      for (const option of normalizedOptions) {
        const key = `${option.locationLat.toFixed(6)}:${option.locationLng.toFixed(6)}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        dedupedOptions.push(option);
      }

      if (dedupedOptions.length > MAX_LISTING_LOCATIONS) {
        onWarning(
          formatTemplate(messages.form.maxLocations, {
            count: MAX_LISTING_LOCATIONS,
          }),
        );
      }
      const limitedOptions = dedupedOptions.slice(0, MAX_LISTING_LOCATIONS);
      const [primaryOption, ...restOptions] = limitedOptions;
      if (!primaryOption) {
        return;
      }

      const {
        locationLat,
        locationLng,
        locationAddressLabel,
        locationAddressParts,
      } = primaryOption;
      if (!Number.isFinite(locationLat) || !Number.isFinite(locationLng)) {
        return;
      }

      setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
      applyCoordinates(locationLat, locationLng);
      applyAddressParts(locationAddressParts ?? null);
      if (!locationAddressParts?.city?.trim()) {
        setValue("locationAddressCity", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
      if (!locationAddressParts?.country?.trim()) {
        setValue("locationAddressCountry", "", {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      const fallbackLabel =
        buildLocationLabelFromAddressParts(locationAddressParts);
      const resolvedLabel = locationAddressLabel?.trim() || fallbackLabel;
      setLocationSearch(resolvedLabel);
      setValue("locationAddressLabel", resolvedLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
      additionalReverseLookupRequestRef.current = {};
      setAdditionalLocations(
        restOptions.slice(0, MAX_ADDITIONAL_LOCATIONS).map((option) =>
          createAdditionalLocationDraft({
            locationLat: option.locationLat,
            locationLng: option.locationLng,
            locationAddressLabel: option.locationAddressLabel,
            locationAddressParts: option.locationAddressParts ?? null,
          }),
        ),
      );

      clearErrors(["locationLat", "locationLng"]);
    },
    [
      applyAddressParts,
      applyCoordinates,
      clearErrors,
      messages.form.maxLocations,
      onWarning,
      resolvedCompanyLocationPrefillOptions,
      setValue,
    ],
  );

  const handleClearLocations = useCallback(() => {
    setActiveMapLocationId(PRIMARY_LOCATION_MAP_ID);
    setLocationSearch("");
    additionalReverseLookupRequestRef.current = {};
    setAdditionalLocations([]);

    setValue("locationLat", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationLng", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressLabel", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationStreet", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationHouseNumber", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationPostalCode", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressCity", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("locationAddressCountry", "", {
      shouldDirty: true,
      shouldTouch: true,
    });

    clearErrors(["locationLat", "locationLng"]);
    onSuccess(messages.form.locationsCleared);
  }, [clearErrors, messages.form.locationsCleared, onSuccess, setValue]);

  return {
    activeMapLocationId,
    activeMapLocationLabel,
    additionalLocations,
    configuredLocationsCount,
    handleAddAdditionalLocation,
    handleApplyCompanyLocation,
    handleClearLocations,
    handleRemoveAdditionalLocation,
    handleRemovePrimaryLocation,
    handleSearchAdditionalLocation,
    handleSearchLocation,
    handleSharedMapPointChange,
    handleUpdateAdditionalLocationSearch,
    hasCompanyLocationPrefill,
    hiddenConfiguredLocationsCount,
    isLocationBusy,
    isLocationModalOpen,
    locationMapPoints,
    locationSearch,
    primaryLocationDisplay,
    resolvedCompanyLocationPrefillOptions,
    setActiveMapLocationId,
    setIsLocationModalOpen,
    setLocationSearch,
    visibleConfiguredLocationDisplays,
  };
}
