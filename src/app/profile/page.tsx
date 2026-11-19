"use client";

import { useEffect, useState, type FormEvent } from "react";
import Workspace from "@/components/common/workspace";
import { ApiError, apiRequest } from "@/lib/api";

type PatientProfile = {
  patientId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  nic: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  nic: string;
  dateOfBirth: string;
  gender: string;
  address: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  phone: "",
  nic: "",
  dateOfBirth: "",
  gender: "",
  address: "",
};

export default function ProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<PatientProfile>("patients/me")
      .then((profile) => {
        if (!active) return;
        setHasProfile(true);
        setForm({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone ?? "",
          nic: profile.nic ?? "",
          dateOfBirth: profile.dateOfBirth ?? "",
          gender: profile.gender ?? "",
          address: profile.address ?? "",
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 404) {
          setHasProfile(false);
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your patient profile."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function update(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const nic = form.nic.trim().toUpperCase();
    if (nic && !/^(?:\d{9}[VX]|\d{12})$/.test(nic)) {
      setError("Enter a valid Sri Lankan NIC number.");
      return;
    }

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      nic: nic || null,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
    };

    setSaving(true);
    try {
      await apiRequest<PatientProfile>("patients/me", {
        method: hasProfile ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setHasProfile(true);
      setMessage(
        hasProfile
          ? "Your patient profile has been updated."
          : "Your patient profile was created."
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Workspace
      role="patient"
      title="My Profile"
      description="View and update your patient information."
    >
      <div className="card max-w-2xl">
        <h2 className="text-lg font-bold">
          {hasProfile ? "Personal Information" : "Complete Your Patient Profile"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {hasProfile
            ? "Your details are stored securely and are used for your appointments."
            : "Your account is registered, but profile setup is still required."}
        </p>

        {loading ? (
          <p role="status" className="mt-4">Loading your profile...</p>
        ) : (
          <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              First name
              <input className="field" name="firstName" value={form.firstName} onChange={update} required />
            </label>
            <label className="text-sm font-medium">
              Last name
              <input className="field" name="lastName" value={form.lastName} onChange={update} required />
            </label>
            <label className="text-sm font-medium">
              Phone number
              <input className="field" name="phone" type="tel" value={form.phone} onChange={update} />
            </label>
            <label className="text-sm font-medium">
              Sri Lankan NIC
              <input className="field" name="nic" value={form.nic} onChange={update} maxLength={20} />
            </label>
            <label className="text-sm font-medium">
              Date of birth
              <input className="field" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update} />
            </label>
            <label className="text-sm font-medium">
              Gender
              <select className="field" name="gender" value={form.gender} onChange={update}>
                <option value="">Choose</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Home address
              <input className="field" name="address" value={form.address} onChange={update} maxLength={500} />
            </label>
            {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700 sm:col-span-2">{message}</p>}
            <button className="primary-button sm:col-span-2" disabled={saving}>
              {saving
                ? "Saving profile..."
                : hasProfile
                  ? "Save changes"
                  : "Create patient profile"}
            </button>
          </form>
        )}
      </div>
    </Workspace>
  );
}
