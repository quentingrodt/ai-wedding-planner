"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { NoteListField } from "@/components/compare/note-list-field";
import { RatingInput } from "@/components/compare/rating";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRICE_BASES,
  VENDOR_CATALOG,
  VENDOR_STATUSES,
  type PriceBasis,
  type VendorCategory,
  type VendorStatus,
} from "@/lib/vendors/catalog";
import { VENDOR_LIMITS, type Vendor, type VendorActionResult } from "@/lib/vendors/schema";
import { vendorTotal } from "@/lib/vendors/payments";
import { saveVendor } from "../actions";
import {
  DetailFields,
  detailState,
  detailValues,
  PaymentFields,
  QuestionChecklist,
  type DetailState,
  type PaymentState,
} from "./vendor-form-sections";

type VendorDialogProps = {
  category: VendorCategory;
  /** Piste à modifier, ou null pour en ajouter une. */
  vendor: Vendor | null;
  currencySymbol: string;
  trigger: ReactNode;
  /** Invités attendus, pour le solde d'un prix par invité. */
  guestCount: number | null;
};

type FormState = {
  name: string;
  status: VendorStatus;
  contactName: string;
  phone: string;
  email: string;
  url: string;
  location: string;
  price: string;
  priceBasis: PriceBasis;
  payments: PaymentState;
  details: DetailState;
  asked: number[];
  meetingDate: string;
  rating: number | null;
  pros: string[];
  cons: string[];
  notes: string;
};

const digits = (value: number | null | undefined) => (value == null ? "" : String(value));
const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

function initialState(category: VendorCategory, vendor: Vendor | null): FormState {
  return {
    name: vendor?.name ?? "",
    status: vendor?.status ?? "idea",
    contactName: vendor?.contact_name ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    url: vendor?.url ?? "",
    location: vendor?.location ?? "",
    price: digits(vendor?.price),
    priceBasis: vendor?.price_basis ?? VENDOR_CATALOG[category].priceBasis,
    payments: {
      deposit: digits(vendor?.deposit),
      depositDue: vendor?.deposit_due ?? "",
      depositPaid: vendor?.deposit_paid ?? false,
      secondPayment: digits(vendor?.second_payment),
      secondDue: vendor?.second_due ?? "",
      secondPaid: vendor?.second_paid ?? false,
      balanceDue: vendor?.balance_due ?? "",
      balancePaid: vendor?.balance_paid ?? false,
    },
    details: detailState(category, vendor?.details ?? {}),
    asked: vendor?.details.asked ?? [],
    meetingDate: vendor?.meeting_date ?? "",
    rating: vendor?.rating ?? null,
    pros: vendor?.pros ?? [],
    cons: vendor?.cons ?? [],
    notes: vendor?.notes ?? "",
  };
}

const fieldClass = "h-11 rounded-xl bg-card text-base";
const selectClass = "h-11 w-full rounded-xl bg-card data-[size=default]:h-11";
const amountDigits = String(VENDOR_LIMITS.price).length;

/** Fiche d'un prestataire : qui, combien, prochain rendez-vous, et ce qu'en pensent les mariés. */
export function VendorDialog({ category, vendor, currencySymbol, trigger, guestCount }: VendorDialogProps) {
  const t = useTranslations("Vendors");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => initialState(category, vendor));
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const total = vendorTotal({ price: toNumber(state.price), price_basis: state.priceBasis }, guestCount);
  const balance =
    total === null
      ? null
      : Math.max(0, total - (toNumber(state.payments.deposit) ?? 0) - (toNumber(state.payments.secondPayment) ?? 0));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setState(initialState(category, vendor));
      setNameError(false);
      setEmailError(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.name.trim() === "") {
      setNameError(true);
      return;
    }
    startTransition(async () => {
      const { payments, details, asked, ...fields } = state;
      const result = await saveVendor(category, vendor?.id ?? null, {
        ...fields,
        price: toNumber(state.price),
        deposit: toNumber(payments.deposit),
        depositDue: payments.depositDue,
        depositPaid: payments.depositPaid,
        secondPayment: toNumber(payments.secondPayment),
        secondDue: payments.secondDue,
        secondPaid: payments.secondPaid,
        balanceDue: payments.balanceDue,
        balancePaid: payments.balancePaid,
        details: { ...detailValues(category, details), ...(asked.length > 0 && { asked }) },
      }).catch((): VendorActionResult => ({ ok: false, error: "generic" }));
      if (!result.ok) {
        // L'adresse email est le seul champ que le formulaire ne peut pas garantir.
        if (result.error === "invalid" && state.email.trim() !== "") setEmailError(true);
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(vendor ? t("dialog.updated") : t("dialog.added", { name: state.name.trim() }));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {vendor ? t("dialog.editTitle") : t("dialog.addTitle", { category: t(`categories.${category}.label`) })}
          </DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-name">{t("fields.name")}</Label>
              <Input
                id="vendor-name"
                value={state.name}
                maxLength={VENDOR_LIMITS.name}
                aria-invalid={nameError || undefined}
                onChange={(event) => {
                  set("name", event.target.value);
                  setNameError(false);
                }}
                className={fieldClass}
              />
              {nameError && <p className="text-sm text-destructive">{t("dialog.nameRequired")}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-status">{t("fields.status")}</Label>
              <Select value={state.status} onValueChange={(value) => set("status", value as VendorStatus)}>
                <SelectTrigger id="vendor-status" className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{t(`statuses.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="flex flex-col gap-4 rounded-2xl bg-linen/60 p-4">
            <legend className="sr-only">{t("dialog.contact")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="vendor-contact" label={t("fields.contactName")} value={state.contactName} max={VENDOR_LIMITS.contactName} onChange={(value) => set("contactName", value)} />
              <TextField id="vendor-phone" label={t("fields.phone")} type="tel" value={state.phone} max={VENDOR_LIMITS.phone} onChange={(value) => set("phone", value)} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-email">{t("fields.email")}</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  inputMode="email"
                  value={state.email}
                  maxLength={VENDOR_LIMITS.email}
                  aria-invalid={emailError || undefined}
                  onChange={(event) => {
                    set("email", event.target.value);
                    setEmailError(false);
                  }}
                  className={fieldClass}
                />
                {emailError && <p className="text-sm text-destructive">{t("dialog.emailInvalid")}</p>}
              </div>
              <TextField id="vendor-url" label={t("fields.url")} type="url" placeholder="https://" value={state.url} max={VENDOR_LIMITS.url} onChange={(value) => set("url", value)} />
            </div>
            <TextField id="vendor-location" label={t("fields.location")} value={state.location} max={VENDOR_LIMITS.location} onChange={(value) => set("location", value)} />
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-2xl bg-linen/60 p-4">
            <legend className="sr-only">{t("dialog.price")}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-price">{t("fields.price")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vendor-price"
                    inputMode="numeric"
                    value={state.price}
                    onChange={(event) => set("price", event.target.value.replace(/\D/g, "").slice(0, amountDigits))}
                    className={`${fieldClass} w-32`}
                  />
                  <span className="text-stone">{currencySymbol}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vendor-basis" className="sr-only">{t("fields.priceBasis")}</Label>
                <Select value={state.priceBasis} onValueChange={(value) => set("priceBasis", value as PriceBasis)}>
                  <SelectTrigger id="vendor-basis" className={`${selectClass} w-44`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_BASES.map((basis) => (
                      <SelectItem key={basis} value={basis}>{t(`priceBases.${basis}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PaymentFields
              state={state.payments}
              onChange={(patch) => set("payments", { ...state.payments, ...patch })}
              balance={balance}
              currencySymbol={currencySymbol}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-meeting">{t("fields.meetingDate")}</Label>
              <Input
                id="vendor-meeting"
                type="date"
                value={state.meetingDate}
                onChange={(event) => set("meetingDate", event.target.value)}
                className={`${fieldClass} w-48`}
              />
              <p className="text-xs text-stone">{t("fields.meetingHint")}</p>
            </div>
          </fieldset>

          <DetailFields
            category={category}
            state={state.details}
            onChange={(key, value) => set("details", { ...state.details, [key]: value })}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>{t("fields.rating")}</Label>
            <RatingInput label={t("fields.rating")} value={state.rating} onChange={(value) => set("rating", value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NoteListField id="vendor-pros" kind="pros" items={state.pros} placeholder={t("fields.prosPlaceholder")} onChange={(items) => set("pros", items)} />
            <NoteListField id="vendor-cons" kind="cons" items={state.cons} placeholder={t("fields.consPlaceholder")} onChange={(items) => set("cons", items)} />
          </div>

          <div className="rounded-2xl bg-linen/60 p-4">
            <QuestionChecklist category={category} asked={state.asked} onChange={(asked) => set("asked", asked)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-notes">{t("fields.notes")}</Label>
            <textarea
              id="vendor-notes"
              value={state.notes}
              maxLength={VENDOR_LIMITS.notes}
              placeholder={t("fields.notesPlaceholder")}
              onChange={(event) => set("notes", event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("saving") : vendor ? t("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  label,
  value,
  max,
  type = "text",
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  type?: "text" | "tel" | "url";
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </div>
  );
}
