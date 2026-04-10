"use client";

import { useForm } from "react-hook-form";
import { useToast } from "@/components/toast-provider";

type InquiryFormValues = {
  buyerName: string;
  buyerEmail: string;
  message: string;
  requestedQuantity?: number;
  offeredPrice?: string;
};

type ContainerInquiryFormProps = {
  listingId: string;
};

export function ContainerInquiryForm({ listingId }: ContainerInquiryFormProps) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>();

  const onSubmit = async (values: InquiryFormValues) => {
    try {
      const response = await fetch(`/api/containers/${listingId}/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; issues?: string[] }
        | null;

      if (!response.ok) {
        const details = Array.isArray(data?.issues) ? ` (${data.issues.join(", ")})` : "";
        throw new Error((data?.error ?? "Nie udalo sie wyslac zapytania") + details);
      }

      toast.success("Zapytanie wyslane");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystapil blad");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-lg font-semibold text-slate-100">Wyslij zapytanie</h2>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Imie i nazwisko *</span>
        <input
          {...register("buyerName", { required: "Podaj imie i nazwisko", minLength: { value: 2, message: "Min. 2 znaki" } })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        {errors.buyerName?.message ? <span className="text-xs text-red-300">{errors.buyerName.message}</span> : null}
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Email *</span>
        <input
          type="email"
          {...register("buyerEmail", { required: "Podaj email" })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        {errors.buyerEmail?.message ? <span className="text-xs text-red-300">{errors.buyerEmail.message}</span> : null}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Oczekiwana ilosc</span>
          <input
            type="number"
            min={1}
            {...register("requestedQuantity", {
              setValueAs: (value) => (value === "" ? undefined : Number(value)),
            })}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Proponowana cena</span>
          <input
            {...register("offeredPrice")}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="np. 2100 EUR"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-300">Wiadomosc *</span>
        <textarea
          rows={5}
          {...register("message", { required: "Wpisz wiadomosc", minLength: { value: 10, message: "Min. 10 znakow" } })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        {errors.message?.message ? <span className="text-xs text-red-300">{errors.message.message}</span> : null}
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isSubmitting ? "Wysylanie..." : "Wyslij zapytanie"}
        </button>
      </div>
    </form>
  );
}

