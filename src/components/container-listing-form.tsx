"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MapLocationPicker } from "@/components/map-location-picker";
import { SimpleRichTextEditor } from "@/components/simple-rich-text-editor";
import { useToast } from "@/components/toast-provider";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import { getRichTextLength, hasRichTextContent } from "@/lib/listing-rich-text";
import {
  CONTAINER_CONDITIONS,
  CONTAINER_FEATURES,
  CONTAINER_HEIGHTS,
  CONTAINER_SIZES,
  CONTAINER_CONDITION_LABEL,
  CONTAINER_FEATURE_LABEL,
  CONTAINER_HEIGHT_LABEL,
  CONTAINER_TYPE_LABEL,
  CONTAINER_TYPES,
  LISTING_TYPES,
  PRICE_CURRENCIES,
  PRICE_CURRENCY_LABEL,
  PRICE_TAX_MODES,
  PRICE_TAX_MODE_LABEL,
  PRICE_TYPES,
  PRICE_TYPE_LABEL,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type ContainerType,
  type Currency,
  type ListingType,
  type PriceType,
  type TaxMode,
} from "@/lib/container-listing-types";

type ContainerListingFormValues = {
  type: ListingType;
  title: string;
  containerSize: ContainerSize;
  containerHeight: ContainerHeight;
  containerType: ContainerType;
  containerFeatures: ContainerFeature[];
  containerCondition: ContainerCondition;
  hasCscPlate: boolean;
  hasCscCertification: boolean;
  cscValidToMonth: string;
  cscValidToYear: string;
  productionYear: string;
  quantity: number;
  locationLat: string;
  locationLng: string;
  locationAddressLabel: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationAddressCity: string;
  locationAddressCountry: string;
  availableNow: boolean;
  availableFromApproximate: boolean;
  availableFrom: string;
  logisticsTransportAvailable: boolean;
  logisticsTransportIncluded: boolean;
  logisticsTransportFreeDistanceKm: string;
  logisticsUnloadingAvailable: boolean;
  logisticsUnloadingIncluded: boolean;
  logisticsComment: string;
  priceType: PriceType;
  priceValueAmount: string;
  priceCurrency: Currency;
  priceTaxMode: TaxMode;
  priceVatRate: string;
  priceNegotiable: boolean;
  price: string;
  description: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
};

type ContainerListingFormProps = {
  mode?: "create" | "edit";
  submitEndpoint: string;
  submitMethod: "POST" | "PATCH";
  submitLabel: string;
  successMessage: string;
  backHref: string;
  backLabel: string;
  initialValues?: Partial<ContainerListingFormValues>;
};

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

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  available: "Dostepny",
  wanted: "Poszukiwany",
};

function toCoordinateText(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(6) : "";
}

function parseCoordinate(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalRichText(value: string): string | undefined {
  const trimmed = value.trim();
  return hasRichTextContent(trimmed) ? trimmed : undefined;
}

function normalizeOptionalNumber(value: string): number | undefined {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

function normalizeOptionalInteger(value: string): number | undefined {
  const parsed = normalizeOptionalNumber(value);
  if (typeof parsed !== "number") {
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function getDefaultValues(
  initialValues?: Partial<ContainerListingFormValues>,
): ContainerListingFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: initialValues?.type ?? "available",
    title: initialValues?.title ?? "",
    containerSize: initialValues?.containerSize ?? 40,
    containerHeight: initialValues?.containerHeight ?? "standard",
    containerType: initialValues?.containerType ?? "dry",
    containerFeatures: initialValues?.containerFeatures ?? [],
    containerCondition: initialValues?.containerCondition ?? "cargo_worthy",
    hasCscPlate: initialValues?.hasCscPlate ?? false,
    hasCscCertification: initialValues?.hasCscCertification ?? false,
    cscValidToMonth: initialValues?.cscValidToMonth ?? "",
    cscValidToYear: initialValues?.cscValidToYear ?? "",
    productionYear: initialValues?.productionYear ?? "",
    quantity: initialValues?.quantity ?? 1,
    locationLat: initialValues?.locationLat ?? "",
    locationLng: initialValues?.locationLng ?? "",
    locationAddressLabel: initialValues?.locationAddressLabel ?? "",
    locationStreet: initialValues?.locationStreet ?? "",
    locationHouseNumber: initialValues?.locationHouseNumber ?? "",
    locationAddressCity: initialValues?.locationAddressCity ?? "",
    locationAddressCountry: initialValues?.locationAddressCountry ?? "",
    availableNow: initialValues?.availableNow ?? false,
    availableFromApproximate: initialValues?.availableFromApproximate ?? false,
    availableFrom: initialValues?.availableFrom ?? today,
    logisticsTransportAvailable: initialValues?.logisticsTransportAvailable ?? false,
    logisticsTransportIncluded: initialValues?.logisticsTransportIncluded ?? false,
    logisticsTransportFreeDistanceKm: initialValues?.logisticsTransportFreeDistanceKm ?? "",
    logisticsUnloadingAvailable: initialValues?.logisticsUnloadingAvailable ?? false,
    logisticsUnloadingIncluded: initialValues?.logisticsUnloadingIncluded ?? false,
    logisticsComment: initialValues?.logisticsComment ?? "",
    priceType: initialValues?.priceType ?? "fixed",
    priceValueAmount: initialValues?.priceValueAmount ?? "",
    priceCurrency: initialValues?.priceCurrency ?? "PLN",
    priceTaxMode: initialValues?.priceTaxMode ?? "net",
    priceVatRate: initialValues?.priceVatRate ?? "",
    priceNegotiable: initialValues?.priceNegotiable ?? false,
    price: initialValues?.price ?? "",
    description: initialValues?.description ?? "",
    companyName: initialValues?.companyName ?? "",
    contactEmail: initialValues?.contactEmail ?? "",
    contactPhone: initialValues?.contactPhone ?? "",
  };
}

export function ContainerListingForm({
  mode = "create",
  submitEndpoint,
  submitMethod,
  submitLabel,
  successMessage,
  backHref,
  backLabel,
  initialValues,
}: ContainerListingFormProps) {
  const router = useRouter();
  const toast = useToast();
  const reverseLookupRequestRef = useRef(0);
  const [locationSearch, setLocationSearch] = useState(
    [
      initialValues?.locationAddressLabel,
      initialValues?.locationAddressCity,
      initialValues?.locationAddressCountry,
    ]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(", "),
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isReverseLookupPending, setIsReverseLookupPending] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContainerListingFormValues>({
    defaultValues: getDefaultValues(initialValues),
  });

  const latValue = watch("locationLat");
  const lngValue = watch("locationLng");
  const priceTypeValue = watch("priceType");
  const availableNowValue = watch("availableNow");
  const logisticsTransportAvailableValue = watch("logisticsTransportAvailable");
  const logisticsTransportIncludedValue = watch("logisticsTransportIncluded");
  const logisticsUnloadingAvailableValue = watch("logisticsUnloadingAvailable");
  const latNumber = parseCoordinate(latValue);
  const lngNumber = parseCoordinate(lngValue);
  const isLocationBusy = isSearchingLocation || isReverseLookupPending;

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

      setValue("locationStreet", street, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("locationHouseNumber", houseNumber, {
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

  const handleMapChange = useCallback(
    async (next: { lat: number; lng: number }) => {
      applyCoordinates(next.lat, next.lng);

      const currentRequestId = reverseLookupRequestRef.current + 1;
      reverseLookupRequestRef.current = currentRequestId;
      setIsReverseLookupPending(true);

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(next.lat.toFixed(6))}&lng=${encodeURIComponent(next.lng.toFixed(6))}&lang=pl`,
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
    [applyAddressParts, applyCoordinates, setValue],
  );

  const handleSearchLocation = useCallback(async () => {
    const query = locationSearch.trim();
    if (query.length < 3) {
      toast.error("Wpisz minimum 3 znaki adresu.");
      return;
    }

    setIsSearchingLocation(true);

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}&lang=pl&limit=1`,
      );
      const data = (await response.json()) as GeocodeSearchResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Nie udalo sie pobrac lokalizacji");
      }

      if (!data.item) {
        toast.error("Brak wynikow. Sprobuj doprecyzowac adres.");
        return;
      }

      applyCoordinates(data.item.lat, data.item.lng);
      applyAddressParts(data.item.addressParts);
      const locationLabel = data.item.shortLabel ?? data.item.label;
      setLocationSearch(locationLabel);
      setValue("locationAddressLabel", locationLabel, {
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udalo sie wyszukac lokalizacji",
      );
    } finally {
      setIsSearchingLocation(false);
    }
  }, [applyAddressParts, applyCoordinates, locationSearch, setValue, toast]);

  const onSubmit = async (values: ContainerListingFormValues) => {
    const locationLat = parseCoordinate(values.locationLat);
    const locationLng = parseCoordinate(values.locationLng);

    if (locationLat === null || locationLng === null) {
      setError("locationLat", {
        type: "validate",
        message: "Wybierz lokalizacje na mapie lub wyszukaj adres",
      });
      setError("locationLng", {
        type: "validate",
        message: "Wybierz lokalizacje na mapie lub wyszukaj adres",
      });
      toast.error("Dodanie kontenera wymaga geolokalizacji");
      return;
    }

    const locationAddressParts = {
      street: normalizeOptionalText(values.locationStreet),
      houseNumber: normalizeOptionalText(values.locationHouseNumber),
      city: normalizeOptionalText(values.locationAddressCity),
      country: normalizeOptionalText(values.locationAddressCountry),
    };
    const hasAddressParts = Object.values(locationAddressParts).some((value) =>
      Boolean(value),
    );
    const normalizedPriceAmount =
      values.priceType === "request"
        ? undefined
        : normalizeOptionalInteger(values.priceValueAmount);
    const normalizedVatRate =
      values.priceType === "request"
        ? undefined
        : normalizeOptionalNumber(values.priceVatRate);
    const normalizedProductionYear = normalizeOptionalNumber(
      values.productionYear,
    );
    const normalizedCscValidToMonth = normalizeOptionalInteger(values.cscValidToMonth);
    const normalizedCscValidToYear = normalizeOptionalInteger(values.cscValidToYear);
    const normalizedLogisticsTransportFreeDistanceKm = normalizeOptionalInteger(
      values.logisticsTransportFreeDistanceKm,
    );
    const trimmedAvailableFrom = values.availableFrom.trim();
    const descriptionLength = getRichTextLength(values.description);

    if (!values.availableNow && trimmedAvailableFrom.length === 0) {
      setError("availableFrom", {
        type: "validate",
        message: "Podaj date albo zaznacz Dostepny teraz",
      });
      toast.error("Podaj date dostepnosci albo zaznacz Dostepny teraz");
      return;
    }

    if (descriptionLength > 1000) {
      setError("description", {
        type: "validate",
        message: "Opis moze miec maksymalnie 1000 znakow",
      });
      toast.error("Opis moze miec maksymalnie 1000 znakow");
      return;
    }

    const hasCscValidToMonth = typeof normalizedCscValidToMonth === "number";
    const hasCscValidToYear = typeof normalizedCscValidToYear === "number";
    if (hasCscValidToMonth !== hasCscValidToYear) {
      setError("cscValidToMonth", {
        type: "validate",
        message: "Podaj miesiac i rok waznosci CSC",
      });
      setError("cscValidToYear", {
        type: "validate",
        message: "Podaj miesiac i rok waznosci CSC",
      });
      toast.error("Podaj miesiac i rok waznosci CSC");
      return;
    }

    if (
      values.logisticsTransportIncluded &&
      typeof normalizedLogisticsTransportFreeDistanceKm !== "number"
    ) {
      setError("logisticsTransportFreeDistanceKm", {
        type: "validate",
        message: "Podaj dodatnia liczbe km dla darmowego transportu",
      });
      toast.error("Uzupelnij dystans darmowego transportu (km)");
      return;
    }

    const pricing =
      values.priceType === "request"
        ? {
            type: values.priceType,
            original: {
              amount: null,
              currency: null,
              taxMode: null,
              vatRate: null,
              negotiable: values.priceNegotiable,
            },
          }
        : {
            type: values.priceType,
            original: {
              amount: normalizedPriceAmount ?? null,
              currency: values.priceCurrency,
              taxMode: values.priceTaxMode,
              vatRate: normalizedVatRate ?? null,
              negotiable: values.priceNegotiable,
            },
          };

    const payload = {
      ...(mode === "edit" ? { action: "update" } : {}),
      type: values.type,
      title: normalizeOptionalText(values.title),
      container: {
        size: values.containerSize,
        height: values.containerHeight,
        type: values.containerType,
        features: Array.from(new Set(values.containerFeatures)),
        condition: values.containerCondition,
      },
      quantity: Number(values.quantity),
      locationLat,
      locationLng,
      locationAddressLabel: normalizeOptionalText(values.locationAddressLabel),
      locationAddressParts: hasAddressParts ? locationAddressParts : undefined,
      availableNow: values.availableNow,
      availableFromApproximate:
        values.availableNow ? false : values.availableFromApproximate,
      availableFrom: values.availableNow ? undefined : values.availableFrom,
      logisticsTransportAvailable:
        values.logisticsTransportAvailable || values.logisticsTransportIncluded,
      logisticsTransportIncluded:
        values.logisticsTransportAvailable && values.logisticsTransportIncluded,
      logisticsTransportFreeDistanceKm:
        values.logisticsTransportIncluded &&
        typeof normalizedLogisticsTransportFreeDistanceKm === "number"
          ? normalizedLogisticsTransportFreeDistanceKm
          : undefined,
      logisticsUnloadingAvailable:
        values.logisticsUnloadingAvailable || values.logisticsUnloadingIncluded,
      logisticsUnloadingIncluded:
        values.logisticsUnloadingAvailable && values.logisticsUnloadingIncluded,
      logisticsComment: normalizeOptionalText(values.logisticsComment),
      pricing,
      priceAmount: normalizedPriceAmount,
      priceNegotiable: values.priceNegotiable,
      hasCscPlate: values.hasCscPlate,
      hasCscCertification: values.hasCscCertification,
      ...(hasCscValidToMonth && hasCscValidToYear
        ? {
            cscValidToMonth: normalizedCscValidToMonth,
            cscValidToYear: normalizedCscValidToYear,
          }
        : {}),
      productionYear:
        typeof normalizedProductionYear === "number"
          ? Math.trunc(normalizedProductionYear)
          : undefined,
      price: values.price.trim() ? values.price.trim() : undefined,
      description: normalizeOptionalRichText(values.description),
      companyName: values.companyName,
      contactEmail: values.contactEmail,
      contactPhone: values.contactPhone.trim()
        ? values.contactPhone.trim()
        : undefined,
    };

    try {
      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        issues?: string[];
      } | null;

      if (!response.ok) {
        const details = Array.isArray(data?.issues)
          ? ` (${data?.issues.join(", ")})`
          : "";
        throw new Error(
          (data?.error ?? "Nie udalo sie zapisac kontenera") + details,
        );
      }

      toast.success(successMessage);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Wystapil blad podczas zapisu",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5"
    >
      <div className="grid gap-1 text-sm">
        <span className="text-neutral-300">Typ ogloszenia *</span>
        <select
          {...register("type", { required: "Wybierz typ ogloszenia" })}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
        >
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {LISTING_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        {errors.type?.message ? (
          <span className="text-xs text-red-300">{errors.type.message}</span>
        ) : null}
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-300">Tytul ogloszenia *</span>
        <input
          {...register("title", {
            required: "Podaj tytul ogloszenia",
            validate: (value) =>
              value.trim().length > 0 || "Podaj tytul ogloszenia",
            maxLength: {
              value: 80,
              message: "Tytul moze miec maksymalnie 80 znakow",
            },
          })}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          placeholder="np. 40HC reefer - szybki odbior w Hamburgu"
        />
        <p className="text-xs text-neutral-400">{watch("title").length}/80</p>
        {errors.title?.message ? (
          <span className="text-xs text-red-300">{errors.title.message}</span>
        ) : null}
      </label>

      <div className="grid gap-4 rounded-lg border border-neutral-700/70 bg-neutral-950/40 p-3">
        <p className="text-sm font-medium text-neutral-200">
          Parametry kontenera *
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Rozmiar</span>
            <select
              {...register("containerSize", {
                required: "Wybierz rozmiar",
                valueAsNumber: true,
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            >
              {CONTAINER_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} ft
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Wysokosc</span>
            <select
              {...register("containerHeight", { required: "Wybierz wysokosc" })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            >
              {CONTAINER_HEIGHTS.map((height) => (
                <option key={height} value={height}>
                  {CONTAINER_HEIGHT_LABEL[height]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Typ</span>
            <select
              {...register("containerType", {
                required: "Wybierz typ kontenera",
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            >
              {CONTAINER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTAINER_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Stan</span>
            <select
              {...register("containerCondition", {
                required: "Wybierz stan kontenera",
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            >
              {CONTAINER_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {CONTAINER_CONDITION_LABEL[condition]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 text-sm">
          <span className="text-neutral-300">Cechy dodatkowe</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONTAINER_FEATURES.map((feature) => (
              <label
                key={feature}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700/70 bg-neutral-900/60 px-2.5 py-1.5 text-xs text-neutral-200"
              >
                <input
                  type="checkbox"
                  value={feature}
                  {...register("containerFeatures")}
                  className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
                />
                <span>{CONTAINER_FEATURE_LABEL[feature]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-300">Ilosc *</span>
          <input
            type="number"
            min={1}
            {...register("quantity", {
              required: "Podaj ilosc",
              valueAsNumber: true,
              min: { value: 1, message: "Ilosc musi byc wieksza od 0" },
            })}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
          {errors.quantity?.message ? (
            <span className="text-xs text-red-300">
              {errors.quantity.message}
            </span>
          ) : null}
        </label>

        <div className="grid gap-2 text-sm">
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-neutral-200">
            <input
              type="checkbox"
              {...register("availableNow", {
                onChange: (event) => {
                  const isChecked = event.target.checked === true;
                  if (isChecked) {
                    setValue("availableFromApproximate", false, {
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                    clearErrors("availableFrom");
                  }
                },
              })}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Dostepny juz teraz</span>
          </label>

          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-neutral-200">
            <input
              type="checkbox"
              disabled={availableNowValue}
              {...register("availableFromApproximate")}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span>Data przyblizona (pokazuj ~)</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Dostepny od {availableNowValue ? "" : "*"}</span>
            <input
              type="date"
              disabled={availableNowValue}
              {...register("availableFrom", {
                validate: (value) =>
                  availableNowValue ||
                  value.trim().length > 0 ||
                  "Podaj date albo zaznacz Dostepny teraz",
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {errors.availableFrom?.message ? (
              <span className="text-xs text-red-300">
                {errors.availableFrom.message}
              </span>
            ) : null}
          </label>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-neutral-700/70 bg-neutral-950/40 p-3">
        <p className="text-sm font-medium text-neutral-200">Lokalizacja *</p>

        <div className="flex overflow-hidden rounded-md border border-neutral-700 bg-neutral-950">
          <div className="relative flex-1">
            <input
              type="text"
              value={locationSearch}
              onChange={(event) => setLocationSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearchLocation();
                }
              }}
              className="w-full border-0 bg-transparent px-3 py-2 pr-9 text-sm text-neutral-100"
              placeholder="Wpisz adres, terminal, miasto..."
            />
            {isLocationBusy ? (
              <span
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              >
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-sky-400" />
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSearchLocation();
            }}
            disabled={isLocationBusy || isSubmitting}
            className="border-l border-neutral-700 bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-700/70"
          >
            Szukaj
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          Lokalizacje prosimy wpisywac bez przedrostkow typu &quot;ulica&quot;,
          &quot;ul.&quot;.
        </p>

        <MapLocationPicker
          lat={latNumber}
          lng={lngNumber}
          labels={{
            hint: "Kliknij na mapie lub przeciagnij znacznik, aby ustawic dokladny punkt.",
          }}
          mapClassName="h-72"
          onChange={(next) => {
            void handleMapChange(next);
          }}
        />

        <input
          type="hidden"
          {...register("locationLat", {
            validate: (value) =>
              parseCoordinate(value) !== null ||
              "Wybierz lokalizacje na mapie lub wyszukaj adres",
          })}
        />
        <input
          type="hidden"
          {...register("locationLng", {
            validate: (value) =>
              parseCoordinate(value) !== null ||
              "Wybierz lokalizacje na mapie lub wyszukaj adres",
          })}
        />
        <input type="hidden" {...register("locationAddressLabel")} />
        <input type="hidden" {...register("locationStreet")} />
        <input type="hidden" {...register("locationHouseNumber")} />
        <input type="hidden" {...register("locationAddressCity")} />
        <input type="hidden" {...register("locationAddressCountry")} />

        {errors.locationLat?.message ? (
          <span className="text-xs text-red-300">
            {errors.locationLat.message}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-neutral-700/70 bg-neutral-950/40 p-3">
        <p className="text-sm font-medium text-neutral-200">Logistyka (opcjonalnie)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              {...register("logisticsTransportAvailable", {
                onChange: (event) => {
                  if (event.target.checked !== true) {
                    setValue("logisticsTransportIncluded", false, {
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                    setValue("logisticsTransportFreeDistanceKm", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                  }
                },
              })}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Mozliwy transport</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              disabled={!logisticsTransportAvailableValue}
              {...register("logisticsTransportIncluded", {
                onChange: (event) => {
                  if (event.target.checked !== true) {
                    setValue("logisticsTransportFreeDistanceKm", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                  }
                },
              })}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span>Transport w cenie</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              {...register("logisticsUnloadingAvailable", {
                onChange: (event) => {
                  if (event.target.checked !== true) {
                    setValue("logisticsUnloadingIncluded", false, {
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                  }
                },
              })}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Mozliwy rozladunek / HDS</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              disabled={!logisticsUnloadingAvailableValue}
              {...register("logisticsUnloadingIncluded")}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span>Rozladunek / HDS w cenie</span>
          </label>
        </div>

        <label className="grid gap-1 text-sm sm:max-w-xs">
          <span className="text-neutral-300">Darmowy transport do (km)</span>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            disabled={!logisticsTransportIncludedValue}
            {...register("logisticsTransportFreeDistanceKm", {
              validate: (value) => {
                if (!logisticsTransportIncludedValue) {
                  return true;
                }
                const parsed = normalizeOptionalInteger(value);
                return (
                  typeof parsed === "number" &&
                  parsed > 0 &&
                  parsed <= 10_000
                ) || "Podaj liczbe km od 1 do 10000";
              },
            })}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="np. 150"
          />
          {errors.logisticsTransportFreeDistanceKm?.message ? (
            <span className="text-xs text-red-300">
              {errors.logisticsTransportFreeDistanceKm.message}
            </span>
          ) : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-300">Komentarz logistyczny</span>
          <textarea
            rows={3}
            {...register("logisticsComment", {
              maxLength: {
                value: 600,
                message: "Komentarz moze miec maksymalnie 600 znakow",
              },
            })}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            placeholder="np. transport po uzgodnieniu, terminy rozladunku, warunki HDS"
          />
          {errors.logisticsComment?.message ? (
            <span className="text-xs text-red-300">
              {errors.logisticsComment.message}
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-3 rounded-lg border border-neutral-700/70 bg-neutral-950/40 p-3">
        <p className="text-sm font-medium text-neutral-200">
          Certyfikacja i cena
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              {...register("hasCscPlate")}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Tabliczka CSC</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              {...register("hasCscCertification")}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Certyfikacja CSC</span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Waznosc CSC miesiac</span>
            <input
              type="number"
              min={1}
              max={12}
              step={1}
              inputMode="numeric"
              {...register("cscValidToMonth", {
                validate: (value) => {
                  const month = normalizeOptionalInteger(value);
                  const year = normalizeOptionalInteger(watch("cscValidToYear"));
                  if (month === undefined && year === undefined) {
                    return true;
                  }
                  return (
                    typeof month === "number" &&
                    month >= 1 &&
                    month <= 12
                  ) || "Podaj miesiac od 1 do 12";
                },
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              placeholder="np. 3"
            />
            {errors.cscValidToMonth?.message ? (
              <span className="text-xs text-red-300">
                {errors.cscValidToMonth.message}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Waznosc CSC rok</span>
            <input
              type="number"
              min={1900}
              max={2100}
              step={1}
              inputMode="numeric"
              {...register("cscValidToYear", {
                validate: (value) => {
                  const year = normalizeOptionalInteger(value);
                  const month = normalizeOptionalInteger(watch("cscValidToMonth"));
                  if (month === undefined && year === undefined) {
                    return true;
                  }
                  return (
                    typeof year === "number" &&
                    year >= 1900 &&
                    year <= 2100
                  ) || "Podaj poprawny rok";
                },
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              placeholder="np. 2030"
            />
            {errors.cscValidToYear?.message ? (
              <span className="text-xs text-red-300">
                {errors.cscValidToYear.message}
              </span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Rok produkcji</span>
            <input
              type="number"
              min={1900}
              max={2100}
              step={1}
              {...register("productionYear")}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              placeholder="np. 2018"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Typ ceny</span>
            <select
              {...register("priceType", { required: "Wybierz typ ceny" })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
            >
              {PRICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PRICE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="text-neutral-300">Kwota</span>
            <input
              type="number"
              min={0}
              step={1}
              disabled={priceTypeValue === "request"}
              {...register("priceValueAmount", {
                validate: (value) => {
                  if (priceTypeValue === "request") {
                    return true;
                  }
                  return (
                    normalizeOptionalInteger(value) !== undefined ||
                    "Podaj kwote ceny jako pelna liczbe"
                  );
                },
              })}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={
                priceTypeValue === "request"
                  ? "Bez kwoty dla zapytania"
                  : "np. 2500"
              }
            />
            {errors.priceValueAmount?.message ? (
              <span className="text-xs text-red-300">
                {errors.priceValueAmount.message}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Waluta</span>
            <select
              {...register("priceCurrency", { required: "Wybierz walute" })}
              disabled={priceTypeValue === "request"}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PRICE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {PRICE_CURRENCY_LABEL[currency]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Podatek</span>
            <select
              {...register("priceTaxMode", {
                required: "Wybierz netto/brutto",
              })}
              disabled={priceTypeValue === "request"}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {PRICE_TAX_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICE_TAX_MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-300">Stawka VAT (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={priceTypeValue === "request"}
              {...register("priceVatRate")}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="np. 23"
            />
            <span className="text-xs text-neutral-400">
              Dla filtrowania netto warto podac VAT przy cenie brutto.
            </span>
          </label>
        </div>

        <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            {...register("priceNegotiable")}
            className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-sky-500 focus:ring-sky-500"
          />
          <span>Cena do negocjacji</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-300">Nazwa firmy *</span>
          <input
            {...register("companyName", {
              required: "Podaj nazwe firmy",
              minLength: { value: 2, message: "Min. 2 znaki" },
            })}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
          {errors.companyName?.message ? (
            <span className="text-xs text-red-300">
              {errors.companyName.message}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-300">Email kontaktowy *</span>
          <input
            type="email"
            {...register("contactEmail", {
              required: "Podaj email kontaktowy",
            })}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
          {errors.contactEmail?.message ? (
            <span className="text-xs text-red-300">
              {errors.contactEmail.message}
            </span>
          ) : null}
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-300">Telefon kontaktowy</span>
        <input
          {...register("contactPhone")}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          placeholder="np. +48 600 000 000"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-300">Cena - notatka (opcjonalnie)</span>
        <input
          {...register("price")}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          placeholder="np. netto, EUR, warunki dostawy"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-300">Opis (opcjonalnie)</span>
        <Controller
          name="description"
          control={control}
          rules={{
            validate: (value) =>
              getRichTextLength(value) <= 1000 ||
              "Opis moze miec maksymalnie 1000 znakow",
          }}
          render={({ field }) => (
            <SimpleRichTextEditor
              value={field.value}
              onChange={field.onChange}
              maxCharacters={1000}
              placeholder="Dodatkowe informacje o kontenerze, warunkach i terminie"
              disabled={isSubmitting}
            />
          )}
        />
        {errors.description?.message ? (
          <span className="text-xs text-red-300">
            {errors.description.message}
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-800 pt-4">
        <Link
          href={backHref}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
        >
          {backLabel}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSubmitting ? "Zapisywanie..." : submitLabel}
        </button>
      </div>
    </form>
  );
}



