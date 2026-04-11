"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { type AppMessages } from "@/lib/i18n";

const PHONE_REGEX = /^[+()0-9\s-]{6,30}$/;

type UserSettingsAccountSectionProps = {
  messages: AppMessages["settingsPage"];
  user: {
    name: string;
    email: string;
    phone: string;
    canChangePassword: boolean;
    isEmailVerified: boolean;
  };
};

export function UserSettingsAccountSection({
  messages,
  user,
}: UserSettingsAccountSectionProps) {
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.name);
  const [profilePhone, setProfilePhone] = useState(user.phone);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const canChangePassword = user.canChangePassword;

  const saveProfile = async () => {
    if (isSavingProfile) {
      return;
    }

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    if (normalizedName.length < 2) {
      toast.error(messages.profileNameValidation);
      return;
    }
    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      toast.error(messages.profilePhoneValidation);
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProfile",
          name: normalizedName,
          phone: normalizedPhone,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.error ?? messages.profileUpdateUnknownError);
        return;
      }

      setProfileName(normalizedName);
      setProfilePhone(normalizedPhone);
      toast.success(messages.profileUpdateSuccess);
      setIsModalOpen(false);
    } catch {
      toast.error(messages.profileUpdateUnknownError);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!canChangePassword || isChangingPassword) {
      return;
    }
    if (currentPassword.length < 8 || newPassword.length < 8) {
      toast.error(messages.passwordValidation);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error(messages.passwordMismatch);
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "changePassword",
          currentPassword,
          newPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        toast.error(payload?.error ?? messages.passwordChangeUnknownError);
        return;
      }

      toast.success(messages.passwordChangeSuccess);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setIsPasswordModalOpen(false);
    } catch {
      toast.error(messages.passwordChangeUnknownError);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">{messages.profileTitle}</h2>
        <p className="mt-2 text-sm text-slate-300">{messages.profileHint}</p>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs text-slate-400">{messages.profileNameLabel}</p>
          <p className="text-sm text-slate-100">{profileName}</p>
          <p className="mt-3 text-xs text-slate-400">{messages.profileEmailLabel}</p>
          <p className="text-sm text-slate-300">{user.email}</p>
          <p className="mt-3 text-xs text-slate-400">{messages.profilePhoneLabel}</p>
          <p className="text-sm text-slate-300">{profilePhone || "-"}</p>
          {!user.isEmailVerified ? (
            <p className="mt-3 rounded-md border border-amber-700/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {messages.emailUnverifiedNotice}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-400"
            onClick={() => {
              setName(profileName);
              setPhone(profilePhone);
              setIsModalOpen(true);
            }}
          >
            {messages.profileOpenModalButton}
          </button>
          {canChangePassword ? (
            <button
              type="button"
              className="rounded-md border border-sky-700 px-4 py-2 text-sm font-medium text-sky-200 hover:border-sky-500"
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setIsPasswordModalOpen(true);
              }}
            >
              {messages.passwordChangeButton}
            </button>
          ) : null}
        </div>
      </section>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{messages.profileModalTitle}</h3>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setIsModalOpen(false);
                }}
              >
                {messages.cancel}
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.profileNameLabel}</span>
                <input
                  name="profile_name"
                  type="text"
                  autoComplete="name"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  placeholder={messages.profileNamePlaceholder}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.profileEmailLabel}</span>
                <input
                  name="profile_email"
                  type="email"
                  autoComplete="email"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-400"
                  value={user.email}
                  readOnly
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.profilePhoneLabel}</span>
                <input
                  name="profile_phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                  }}
                  placeholder={messages.profilePhonePlaceholder}
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingProfile}
                  onClick={() => {
                    void saveProfile();
                  }}
                >
                  {isSavingProfile ? messages.profileSaveSubmitting : messages.profileSaveButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPasswordModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[rgba(2,6,23,0.45)] p-4 backdrop-blur-[2px] [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{messages.passwordTitle}</h3>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                }}
              >
                {messages.cancel}
              </button>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.passwordCurrentLabel}</span>
                <input
                  name="current_password"
                  type="password"
                  autoComplete="off"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                  }}
                  placeholder={messages.passwordCurrentPlaceholder}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.passwordNewLabel}</span>
                <input
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                  }}
                  placeholder={messages.passwordNewPlaceholder}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">{messages.passwordConfirmLabel}</span>
                <input
                  name="confirm_new_password"
                  type="password"
                  autoComplete="new-password"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={confirmNewPassword}
                  onChange={(event) => {
                    setConfirmNewPassword(event.target.value);
                  }}
                  placeholder={messages.passwordConfirmPlaceholder}
                />
              </label>

              <div>
                <button
                  type="button"
                  className="rounded-md border border-sky-600 px-4 py-2 text-sm font-medium text-sky-200 hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isChangingPassword}
                  onClick={() => {
                    void changePassword();
                  }}
                >
                  {isChangingPassword
                    ? messages.passwordChangeSubmitting
                    : messages.passwordChangeButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
