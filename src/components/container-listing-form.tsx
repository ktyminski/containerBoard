"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MapLocationPicker } from "@/components/job-announcement-form-parts";
import { useToast } from "@/components/toast-provider";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
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
  DEAL_TYPES,
  LISTING_TYPES,
  type ContainerCondition,
  type ContainerFeature,
  type ContainerHeight,
  type ContainerSize,
  type ContainerType,
  type DealType,
  type ListingType,
} from "@/lib/container-listing-types";

type ContainerListingFormValues = {
  type: ListingType;
  containerSize: ContainerSize;
  containerHeight: ContainerHeight;
  containerType: ContainerType;
  containerFeatures: ContainerFeature[];
  containerCondition: ContainerCondition;
  quantity: number;
  locationLat: string;
  locationLng: string;
  locationAddressLabel: string;
  locationStreet: string;
  locationHouseNumber: string;
  locationAddressCity: string;
  locationAddressCountry: string;
  availableFrom: string;
  dealType: DealType;
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

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sale: "Sprzedaz",
  rent: "Wynajem",
  one_way: "One way",
  long_term: "Wspolpraca dlugoterminowa",
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

function getDefaultValues(initialValues?: Partial<ContainerListingFormValues>): ContainerListingFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: initialValues?.type ?? "available",
    containerSize: initialValues?.containerSize ?? 40,
    containerHeight: initialValues?.containerHeight ?? "standard",
    containerType: initialValues?.containerType ?? "dry",
    containerFeatures: initialValues?.containerFeatures ?? [],
    containerCondition: initialValues?.containerCondition ?? "cargo_worthy",
    quantity: initialValues?.quantity ?? 1,
    locationLat: initialValues?.locationLat ?? "",
    locationLng: initialValues?.locationLng ?? "",
    locationAddressLabel: initialValues?.locationAddressLabel ?? "",
    locationStreet: initialValues?.locationStreet ?? "",
    locationHouseNumber: initialValues?.locationHouseNumber ?? "",
    locationAddressCity: initialValues?.locationAddressCity ?? "",
    locationAddressCountry: initialValues?.locationAddressCountry ?? "",
    availableFrom: initialValues?.availableFrom ?? today,
    dealType: initialValues?.dealType ?? "sale",
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
    [initialValues?.locationAddressLabel, initialValues?.locationAddressCity, initialValues?.locationAddressCountry]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(", "),
  );
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isReverseLookupPending, setIsReverseLookupPending] = useState(false);

  const {
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
  const latNumber = parseCoordinate(latValue);
  const lngNumber = parseCoordinate(lngValue);
  const isLocationBusy = isSearchingLocation || isReverseLookupPending;

  const applyCoordinates = useCallback((nextLat: number, nextLng: number) => {
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
  }, [clearErrors, setValue]);

  const applyAddressParts = useCallback((parts?: GeocodeAddressParts | null) => {
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
  }, [setValue]);

  const handleMapChange = useCallback(async (next: { lat: number; lng: number }) => {
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
  }, [applyAddressParts, applyCoordinates, setValue]);

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
      toast.error(error instanceof Error ? error.message : "Nie udalo sie wyszukac lokalizacji");
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
    const hasAddressParts = Object.values(locationAddressParts).some((value) => Boolean(value));

    const payload = {
      ...(mode === "edit" ? { action: "update" } : {}),
      type: values.type,
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
      availableFrom: values.availableFrom,
      dealType: values.dealType,
      price: values.price.trim() ? values.price.trim() : undefined,
      description: values.description.trim() ? values.description.trim() : undefined,
      companyName: values.companyName,
      contactEmail: values.contactEmail,
      contactPhone: values.contactPhone.trim() ? values.contactPhone.trim() : undefined,
    };

    try {
      const response = await fetch(submitEndpoint, {
        method: submitMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; issues?: string[] }
        | null;

      if (!response.ok) {
        const details = Array.isArray(data?.issues) ? ` (${data?.issues.join(", ")})` : "";
        throw new Error((data?.error ?? "Nie udalo sie zapisac kontenera") + details);
      }

      toast.success(successMessage);
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystapil blad podczas zapisu");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="grid gap-1 text-sm">
        <span className="text-slate-300">Typ ogloszenia *</span>
        <select
          {...register("type", { required: "Wybierz typ ogloszenia" })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        >
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>{LISTING_TYPE_LABEL[type]}</option>
          ))}
        </select>
        {errors.type?.message ? <span className="text-xs text-red-300">{errors.type.message}</span> : null}
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-sm font-medium text-slate-200">Parametry kontenera *</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Rozmiar</span>
            <select
              {...register("containerSize", {
                required: "Wybierz rozmiar",
                valueAsNumber: true,
              })}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {CONTAINER_SIZES.map((size) => (
                <option key={size} value={size}>{size} ft</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Wysokosc</span>
            <select
              {...register("containerHeight", { required: "Wybierz wysokosc" })}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {CONTAINER_HEIGHTS.map((height) => (
                <option key={height} value={height}>{CONTAINER_HEIGHT_LABEL[height]}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Typ</span>
            <select
              {...register("containerType", { required: "Wybierz typ kontenera" })}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {CONTAINER_TYPES.map((type) => (
                <option key={type} value={type}>{CONTAINER_TYPE_LABEL[type]}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Stan</span>
            <select
              {...register("containerCondition", { required: "Wybierz stan kontenera" })}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {CONTAINER_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>{CONTAINER_CONDITION_LABEL[condition]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 text-sm">
          <span className="text-slate-300">Cechy dodatkowe</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CONTAINER_FEATURES.map((feature) => (
              <label
                key={feature}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200"
              >
                <input
                  type="checkbox"
                  value={feature}
                  {...register("containerFeatures")}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500"
                />
                <span>{CONTAINER_FEATURE_LABEL[feature]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Ilosc *</span>
          <input
            type="number"
            min={1}
            {...register("quantity", {
              required: "Podaj ilosc",
              valueAsNumber: true,
              min: { value: 1, message: "Ilosc musi byc wieksza od 0" },
            })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.quantity?.message ? <span className="text-xs text-red-300">{errors.quantity.message}</span> : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Dostepny od *</span>
          <input
            type="date"
            {...register("availableFrom", { required: "Podaj date" })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.availableFrom?.message ? <span className="text-xs text-red-300">{errors.availableFrom.message}</span> : null}
        </label>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-sm font-medium text-slate-200">Lokalizacja *</p>

        <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-950">
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
              className="w-full border-0 bg-transparent px-3 py-2 pr-9 text-sm text-slate-100 outline-none"
              placeholder="Wpisz adres, terminal, miasto..."
            />
            {isLocationBusy ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" aria-hidden="true">
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400" />
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSearchLocation();
            }}
            disabled={isLocationBusy || isSubmitting}
            className="border-l border-slate-700 bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-700/70"
          >
            Szukaj
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Lokalizacje prosimy wpisywac bez przedrostkow typu &quot;ulica&quot;, &quot;ul.&quot;.
        </p>

        <MapLocationPicker
          lat={latNumber}
          lng={lngNumber}
          labels={{ hint: "Kliknij na mapie lub przeciagnij znacznik, aby ustawic dokladny punkt." }}
          mapClassName="h-72"
          onChange={(next) => {
            void handleMapChange(next);
          }}
        />

        <input
          type="hidden"
          {...register("locationLat", {
            validate: (value) => parseCoordinate(value) !== null || "Wybierz lokalizacje na mapie lub wyszukaj adres",
          })}
        />
        <input
          type="hidden"
          {...register("locationLng", {
            validate: (value) => parseCoordinate(value) !== null || "Wybierz lokalizacje na mapie lub wyszukaj adres",
          })}
        />
        <input type="hidden" {...register("locationAddressLabel")} />
        <input type="hidden" {...register("locationStreet")} />
        <input type="hidden" {...register("locationHouseNumber")} />
        <input type="hidden" {...register("locationAddressCity")} />
        <input type="hidden" {...register("locationAddressCountry")} />

        {errors.locationLat?.message ? (
          <span className="text-xs text-red-300">{errors.locationLat.message}</span>
        ) : null}

      </div>

      <div className="grid gap-1 text-sm">
        <span className="text-slate-300">Typ transakcji *</span>
        <select
          {...register("dealType", { required: "Wybierz typ transakcji" })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        >
          {DEAL_TYPES.map((type) => (
            <option key={type} value={type}>{DEAL_TYPE_LABEL[type]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Nazwa firmy *</span>
          <input
            {...register("companyName", { required: "Podaj nazwe firmy", minLength: { value: 2, message: "Min. 2 znaki" } })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.companyName?.message ? <span className="text-xs text-red-300">{errors.companyName.message}</span> : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Email kontaktowy *</span>
          <input
            type="email"
            {...register("contactEmail", { required: "Podaj email kontaktowy" })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.contactEmail?.message ? <span className="text-xs text-red-300">{errors.contactEmail.message}</span> : null}
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Telefon kontaktowy</span>
        <input
          {...register("contactPhone")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="np. +48 600 000 000"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Cena (opcjonalnie)</span>
        <input
          {...register("price")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="np. 2500 EUR"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Opis (opcjonalnie)</span>
        <textarea
          rows={4}
          {...register("description")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Dodatkowe informacje o kontenerze, warunkach i terminie"
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
        <Link href={backHref} className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">
          {backLabel}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSubmitting ? "Zapisywanie..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
