"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppMessages } from "@/lib/i18n";

type TransportCompanyServiceKey = "transport" | "unloading";

type TransportCompanyLocation = {
  label: string;
  city?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lng: number;
};

type AdminTransportCompanyItem = {
  id: string;
  name: string;
  description: string;
  services: TransportCompanyServiceKey[];
  terms: string;
  transportPrice: string;
  location: TransportCompanyLocation;
  phone: string;
  email: string;
  isActive: boolean;
  detailsViewCount: number;
  createdAt: string;
  updatedAt: string;
};

type AdminTransportCompaniesResponse = {
  items?: AdminTransportCompanyItem[];
  item?: AdminTransportCompanyItem;
  error?: string;
};

type GeocodeResponse = {
  item?: {
    lat: number;
    lng: number;
    shortLabel?: string;
    label: string;
    addressParts?: {
      city?: string;
      country?: string;
    } | null;
    countryCode?: string | null;
  } | null;
  error?: string;
};

type AdminTransportCompaniesTableProps = {
  messages: AppMessages["adminTransportCompanies"];
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  hasTransport: boolean;
  hasUnloading: boolean;
  terms: string;
  transportPrice: string;
  locationLabel: string;
  locationCity: string;
  locationCountry: string;
  locationCountryCode: string;
  locationLat: string;
  locationLng: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  description: "",
  hasTransport: true,
  hasUnloading: false,
  terms: "",
  transportPrice: "",
  locationLabel: "",
  locationCity: "",
  locationCountry: "",
  locationCountryCode: "",
  locationLat: "",
  locationLng: "",
  phone: "",
  email: "",
  isActive: true,
};

const INPUT_CLASS =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500";
const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500";
const BUTTON_CLASS =
  "rounded-md border border-neutral-600 bg-neutral-800/90 px-3 py-1.5 text-sm text-neutral-100 hover:border-neutral-500 hover:bg-neutral-700/90 disabled:cursor-not-allowed disabled:opacity-60";

function itemToForm(item: AdminTransportCompanyItem): FormState {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    hasTransport: item.services.includes("transport"),
    hasUnloading: item.services.includes("unloading"),
    terms: item.terms,
    transportPrice: item.transportPrice,
    locationLabel: item.location.label,
    locationCity: item.location.city ?? "",
    locationCountry: item.location.country ?? "",
    locationCountryCode: item.location.countryCode ?? "",
    locationLat: String(item.location.lat),
    locationLng: String(item.location.lng),
    phone: item.phone,
    email: item.email,
    isActive: item.isActive,
  };
}

export function AdminTransportCompaniesTable({
  messages,
}: AdminTransportCompaniesTableProps) {
  const [items, setItems] = useState<AdminTransportCompanyItem[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ active: activeFilter });
    if (searchInput.trim()) {
      params.set("q", searchInput.trim());
    }
    return params.toString();
  }, [activeFilter, searchInput]);

  const loadItems = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/transport-companies?${queryString}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AdminTransportCompaniesResponse;
      if (!response.ok) {
        throw new Error(data.error ?? messages.errors.load);
      }
      setItems(data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : messages.errors.unknown);
    } finally {
      setIsLoading(false);
    }
  }, [messages.errors.load, messages.errors.unknown, queryString]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const geocodeLocation = async () => {
    const query = form.locationLabel.trim();
    if (query.length < 3) {
      setError(messages.errors.locationRequired);
      return;
    }
    setError(null);
    setGeocoding(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "1" });
      const response = await fetch(`/api/geocode?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as GeocodeResponse;
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? messages.errors.geocode);
      }
      const item = data.item;
      setForm((current) => ({
        ...current,
        locationLabel: item.shortLabel || item.label || current.locationLabel,
        locationCity: item.addressParts?.city ?? current.locationCity,
        locationCountry: item.addressParts?.country ?? current.locationCountry,
        locationCountryCode: item.countryCode ?? current.locationCountryCode,
        locationLat: String(item.lat),
        locationLng: String(item.lng),
      }));
    } catch (geocodeError) {
      setError(geocodeError instanceof Error ? geocodeError.message : messages.errors.geocode);
    } finally {
      setGeocoding(false);
    }
  };

  const saveItem = async () => {
    setError(null);
    const lat = Number(form.locationLat);
    const lng = Number(form.locationLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(messages.errors.coordinatesRequired);
      return;
    }
    if (!form.hasTransport && !form.hasUnloading) {
      setError(messages.errors.serviceRequired);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        description: form.description,
        services: {
          transport: form.hasTransport,
          unloading: form.hasUnloading,
        },
        terms: form.terms,
        transportPrice: form.transportPrice,
        location: {
          label: form.locationLabel,
          city: form.locationCity || undefined,
          country: form.locationCountry || undefined,
          countryCode: form.locationCountryCode || undefined,
          lat,
          lng,
        },
        phone: form.phone,
        email: form.email,
        isActive: form.isActive,
      };
      const response = await fetch("/api/admin/transport-companies", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as AdminTransportCompaniesResponse;
      if (!response.ok) {
        throw new Error(data.error ?? messages.errors.save);
      }
      setForm(EMPTY_FORM);
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : messages.errors.save);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (item: AdminTransportCompanyItem) => {
    if (!window.confirm(messages.deleteConfirm.replace("{name}", item.name))) {
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/admin/transport-companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = (await response.json()) as AdminTransportCompaniesResponse;
      if (!response.ok) {
        throw new Error(data.error ?? messages.errors.delete);
      }
      if (form.id === item.id) {
        setForm(EMPTY_FORM);
      }
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : messages.errors.delete);
    }
  };

  return (
    <div className="grid gap-4 text-neutral-100">
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{messages.title}</h2>
            <p className="mt-1 text-sm text-neutral-400">{messages.subtitle}</p>
          </div>
          <button type="button" className={BUTTON_CLASS} onClick={() => setForm(EMPTY_FORM)}>
            {messages.newButton}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.name}
            <input
              className={INPUT_CLASS}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.email}
            <input
              className={INPUT_CLASS}
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.phone}
            <input
              className={INPUT_CLASS}
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.transportPrice}
            <input
              className={INPUT_CLASS}
              value={form.transportPrice}
              onChange={(event) => updateField("transportPrice", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400 md:col-span-2">
            {messages.fields.description}
            <textarea
              className={TEXTAREA_CLASS}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400 md:col-span-2">
            {messages.fields.terms}
            <textarea
              className={TEXTAREA_CLASS}
              value={form.terms}
              onChange={(event) => updateField("terms", event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.location}
            <input
              className={INPUT_CLASS}
              value={form.locationLabel}
              onChange={(event) => updateField("locationLabel", event.target.value)}
            />
          </label>
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={geocodeLocation}
            disabled={geocoding}
          >
            {geocoding ? messages.geocoding : messages.geocodeButton}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.city}
            <input
              className={INPUT_CLASS}
              value={form.locationCity}
              onChange={(event) => updateField("locationCity", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.country}
            <input
              className={INPUT_CLASS}
              value={form.locationCountry}
              onChange={(event) => updateField("locationCountry", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.lat}
            <input
              className={INPUT_CLASS}
              value={form.locationLat}
              onChange={(event) => updateField("locationLat", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-neutral-400">
            {messages.fields.lng}
            <input
              className={INPUT_CLASS}
              value={form.locationLng}
              onChange={(event) => updateField("locationLng", event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-200">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.hasTransport}
              onChange={(event) => updateField("hasTransport", event.target.checked)}
            />
            {messages.fields.transport}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.hasUnloading}
              onChange={(event) => updateField("hasUnloading", event.target.checked)}
            />
            {messages.fields.unloading}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateField("isActive", event.target.checked)}
            />
            {messages.fields.active}
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-rose-500/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          {form.id ? (
            <button type="button" className={BUTTON_CLASS} onClick={() => setForm(EMPTY_FORM)}>
              {messages.cancelButton}
            </button>
          ) : null}
          <button type="button" className={BUTTON_CLASS} onClick={saveItem} disabled={isSaving}>
            {isSaving ? messages.saving : form.id ? messages.updateButton : messages.createButton}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className={`${INPUT_CLASS} max-w-sm`}
            placeholder={messages.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className={`${INPUT_CLASS} w-auto`}
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as "all" | "active" | "inactive")
            }
          >
            <option value="all">{messages.filters.all}</option>
            <option value="active">{messages.filters.active}</option>
            <option value="inactive">{messages.filters.inactive}</option>
          </select>
        </div>

        <div className="mt-4 grid gap-3">
          {isLoading ? <p className="text-sm text-neutral-400">{messages.loading}</p> : null}
          {!isLoading && items.length === 0 ? (
            <p className="text-sm text-neutral-400">{messages.empty}</p>
          ) : null}
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-900/70 p-3 md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-neutral-100">{item.name}</p>
                  <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
                    {item.isActive ? messages.statusActive : messages.statusInactive}
                  </span>
                  {item.services.map((service) => (
                    <span
                      key={`${item.id}-${service}`}
                      className="rounded-md border border-emerald-700/70 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-100"
                    >
                      {service === "transport"
                        ? messages.fields.transport
                        : messages.fields.unloading}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-sm text-neutral-400">{item.description}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {item.location.label} | {item.email}
                  {item.phone ? ` | ${item.phone}` : ""}
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-400">
                  {messages.detailsViews}:{" "}
                  <span className="text-neutral-200">
                    {item.detailsViewCount}
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-2 md:justify-end">
                <button type="button" className={BUTTON_CLASS} onClick={() => setForm(itemToForm(item))}>
                  {messages.editButton}
                </button>
                <button type="button" className={BUTTON_CLASS} onClick={() => void deleteItem(item)}>
                  {messages.deleteButton}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
