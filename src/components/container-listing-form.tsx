"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";
import {
  CONTAINER_TYPES,
  DEAL_TYPES,
  LISTING_TYPES,
  type ContainerType,
  type DealType,
  type ListingType,
} from "@/lib/container-listing-types";

type ContainerListingFormValues = {
  type: ListingType;
  containerType: ContainerType;
  quantity: number;
  locationCity: string;
  locationCountry: string;
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

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  available: "Dostepny",
  wanted: "Poszukiwany",
};

const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  "20DV": "20DV",
  "40DV": "40DV",
  "40HC": "40HC",
  reefer: "Reefer",
  open_top: "Open Top",
  flat_rack: "Flat Rack",
  other: "Inny",
};

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sale: "Sprzedaz",
  rent: "Wynajem",
  one_way: "One way",
  long_term: "Wspolpraca dlugoterminowa",
};

function getDefaultValues(initialValues?: Partial<ContainerListingFormValues>): ContainerListingFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: initialValues?.type ?? "available",
    containerType: initialValues?.containerType ?? "20DV",
    quantity: initialValues?.quantity ?? 1,
    locationCity: initialValues?.locationCity ?? "",
    locationCountry: initialValues?.locationCountry ?? "",
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContainerListingFormValues>({
    defaultValues: getDefaultValues(initialValues),
  });

  const onSubmit = async (values: ContainerListingFormValues) => {
    const payload = {
      ...(mode === "edit" ? { action: "update" } : {}),
      type: values.type,
      containerType: values.containerType,
      quantity: Number(values.quantity),
      locationCity: values.locationCity,
      locationCountry: values.locationCountry,
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

      <div className="grid gap-1 text-sm">
        <span className="text-slate-300">Typ kontenera *</span>
        <select
          {...register("containerType", { required: "Wybierz typ kontenera" })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        >
          {CONTAINER_TYPES.map((type) => (
            <option key={type} value={type}>{CONTAINER_TYPE_LABEL[type]}</option>
          ))}
        </select>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Miasto *</span>
          <input
            {...register("locationCity", { required: "Podaj miasto", minLength: { value: 2, message: "Min. 2 znaki" } })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.locationCity?.message ? <span className="text-xs text-red-300">{errors.locationCity.message}</span> : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Kraj *</span>
          <input
            {...register("locationCountry", { required: "Podaj kraj", minLength: { value: 2, message: "Min. 2 znaki" } })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          {errors.locationCountry?.message ? <span className="text-xs text-red-300">{errors.locationCountry.message}</span> : null}
        </label>
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

