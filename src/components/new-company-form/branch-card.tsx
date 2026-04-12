"use client";

import { useState } from "react";
import type {
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { BranchLocationPicker } from "@/components/branch-location-picker";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import {
  PHONE_REGEX,
  getFieldMessage,
  hasValidCoordinate,
} from "./helpers";
import type { BranchFormValue, NewCompanyFormValues } from "./types";

type BranchCardProps = {
  locale: AppLocale;
  messages: AppMessages["companyCreate"];
  index: number;
  branchesCount: number;
  branch: BranchFormValue | undefined;
  register: UseFormRegister<NewCompanyFormValues>;
  getValues: UseFormGetValues<NewCompanyFormValues>;
  setValue: UseFormSetValue<NewCompanyFormValues>;
  branchLabelError: string | null;
  branchAddressError: string | null;
  branchLatError: string | null;
  branchPhoneError: string | null;
  branchEmailError: string | null;
  branchPhoneTouched: boolean;
  branchEmailTouched: boolean;
  isSubmitted: boolean;
  isVisible: boolean;
  onRemoveBranch: (index: number) => void;
};

type GeocodeResponse = {
  item: {
    lat: number;
    lng: number;
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

export function BranchCard({
  locale,
  messages,
  index,
  branchesCount,
  branch,
  register,
  getValues,
  setValue,
  branchLabelError,
  branchAddressError,
  branchLatError,
  branchPhoneError,
  branchEmailError,
  branchPhoneTouched,
  branchEmailTouched,
  isSubmitted,
  isVisible,
  onRemoveBranch,
}: BranchCardProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  const locateByAddress = async () => {
    const query = getValues(`branches.${index}.addressText`).trim();
    if (query.length < 3) {
      setLocationStatus(messages.branchAddressRequiredForSearch);
      return;
    }

    setLocationStatus(null);
    setIsLocating(true);

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}&lang=${locale}`,
      );
      const data = (await response.json()) as GeocodeResponse;

      if (!response.ok || data.error) {
        setLocationStatus(messages.branchLocationLookupFailed);
        return;
      }

      if (!data.item) {
        setLocationStatus(messages.branchLocationNotFound);
        return;
      }

      setValue(`branches.${index}.addressText`, data.item.label, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue(`branches.${index}.lat`, data.item.lat.toFixed(6), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue(`branches.${index}.lng`, data.item.lng.toFixed(6), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue(`branches.${index}.addressParts`, data.item.addressParts ?? null, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setLocationStatus(messages.branchLocationFound);
    } catch {
      setLocationStatus(messages.branchLocationLookupFailed);
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-neutral-500/60 bg-neutral-700/35 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-200">
          {index === 0
            ? messages.mainBranchTitle
            : `${messages.branchesTitle} #${index + 1}`}
        </p>
        {branchesCount > 1 ? (
          <button
            type="button"
            className="cursor-pointer rounded-md border border-red-700 px-2 py-1 text-xs text-red-300 hover:border-red-500"
            onClick={() => onRemoveBranch(index)}
          >
            {messages.removeBranch}
          </button>
        ) : null}
      </div>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-300">{messages.branchLabel}*</span>
        <input
          className="rounded-md border border-neutral-300 bg-neutral-100/85 px-3 py-2 text-neutral-800 placeholder:text-[#94a3b8]"
          {...register(`branches.${index}.label`, {
            required: messages.requiredField,
            minLength: { value: 1, message: messages.requiredField },
            maxLength: { value: 120, message: messages.validationError },
          })}
        />
        {branchLabelError ? <p className="text-xs text-red-300">{branchLabelError}</p> : null}
      </label>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-300">{messages.branchNote}</span>
        <input
          className="rounded-md border border-neutral-300 bg-neutral-100/85 px-3 py-2 text-neutral-800 placeholder:text-[#94a3b8]"
          {...register(`branches.${index}.note`, {
            maxLength: { value: 200, message: messages.validationError },
          })}
        />
      </label>

      <label className="mx-auto grid w-full gap-1 text-sm md:w-[70%]">
        <span className="text-neutral-300">{messages.branchAddress}*</span>
        <div className="flex overflow-hidden rounded-md border border-neutral-300 bg-neutral-100/85">
          <input
            className="w-full bg-transparent px-3 py-2 text-neutral-800 outline-none"
            {...register(`branches.${index}.addressText`, {
              required: messages.requiredField,
              minLength: { value: 1, message: messages.requiredField },
              maxLength: { value: 200, message: messages.validationError },
              onChange: () => {
                setValue(`branches.${index}.addressParts`, null, {
                  shouldDirty: true,
                  shouldValidate: false,
                });
              },
            })}
          />
          <button
            type="button"
            className="cursor-pointer border-l border-neutral-300 px-3 text-xs text-neutral-700 hover:bg-neutral-200/70 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void locateByAddress();
            }}
            disabled={isLocating}
          >
            {isLocating ? messages.branchLocationSearching : messages.branchLocationFind}
          </button>
        </div>
        <p className="text-xs text-neutral-400">{messages.branchAddressNoPrefixHint}</p>
        {branchAddressError ? <p className="text-xs text-red-300">{branchAddressError}</p> : null}
        {locationStatus ? <p className="text-xs text-neutral-600">{locationStatus}</p> : null}
      </label>

      <input
        type="hidden"
        {...register(`branches.${index}.lat`, {
          validate: (value) =>
            hasValidCoordinate(value) || messages.branchLocationRequiredError,
        })}
      />
      <input
        type="hidden"
        {...register(`branches.${index}.lng`, {
          validate: (value) =>
            hasValidCoordinate(value) || messages.branchLocationRequiredError,
        })}
      />

      <BranchLocationPicker
        locale={locale}
        messages={messages}
        lat={branch?.lat ?? ""}
        lng={branch?.lng ?? ""}
        isVisible={isVisible}
        onStatusChange={setLocationStatus}
        onChange={(next) => {
          setValue(`branches.${index}.lat`, next.lat, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue(`branches.${index}.lng`, next.lng, {
            shouldDirty: true,
            shouldValidate: true,
          });
          if (next.addressText) {
            setValue(`branches.${index}.addressText`, next.addressText, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          if (typeof next.addressParts !== "undefined") {
            setValue(`branches.${index}.addressParts`, next.addressParts ?? null, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }
        }}
      />
      {branchLatError ? <p className="text-xs text-red-300">{branchLatError}</p> : null}

      <div className="grid gap-3">
        <button
          type="button"
          className="cursor-pointer text-sm text-neutral-700 hover:text-neutral-900"
          onClick={() => {
            const nextUseCustomDetails = !Boolean(branch?.useCustomDetails);
            if (!nextUseCustomDetails) {
              setValue(`branches.${index}.phone`, "", {
                shouldDirty: true,
                shouldValidate: false,
              });
              setValue(`branches.${index}.email`, "", {
                shouldDirty: true,
                shouldValidate: false,
              });
              setValue(`branches.${index}.category`, "", {
                shouldDirty: true,
                shouldValidate: false,
              });
            }
            setValue(
              `branches.${index}.useCustomDetails`,
              nextUseCustomDetails,
              { shouldDirty: true, shouldValidate: true },
            );
          }}
        >
          {branch?.useCustomDetails
            ? messages.hideAdditionalData
            : messages.showAdditionalData}
        </button>

        {branch?.useCustomDetails ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-300">{messages.branchPhone}</span>
              <input
                className="rounded-md border border-neutral-300 bg-neutral-100/85 px-3 py-2 text-neutral-800 placeholder:text-[#94a3b8]"
                {...register(`branches.${index}.phone`, {
                  validate: (value) =>
                    !value.trim() || PHONE_REGEX.test(value) || messages.invalidPhone,
                })}
              />
              {getFieldMessage(branchPhoneError) &&
              (branchPhoneTouched || isSubmitted) ? (
                <p className="text-xs text-red-300">{branchPhoneError}</p>
              ) : null}
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-300">{messages.branchEmail}</span>
              <input
                className="rounded-md border border-neutral-300 bg-neutral-100/85 px-3 py-2 text-neutral-800 placeholder:text-[#94a3b8]"
                {...register(`branches.${index}.email`, {
                  validate: (value) =>
                    !value.trim() ||
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
                    messages.invalidEmail,
                })}
              />
              {getFieldMessage(branchEmailError) &&
              (branchEmailTouched || isSubmitted) ? (
                <p className="text-xs text-red-300">{branchEmailError}</p>
              ) : null}
            </label>
          </div>
        ) : (
          <p className="text-center text-xs text-neutral-300">{messages.additionalData}</p>
        )}
      </div>

    </div>
  );
}



