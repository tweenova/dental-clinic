"use client";

import { usePublicContent } from "@/components/providers/public-content-provider";

export function LegalContactBox({
  officerTitle = "Office Administration",
}: {
  officerTitle?: string;
}) {
  const { content, primaryLocation } = usePublicContent();
  const practiceName = content.general?.practiceName || "Marlow Dental";
  const phone = content.general?.phone || primaryLocation?.phone || "Clinic Phone";
  const email = content.general?.email || primaryLocation?.email || "";
  const addressLine1 = primaryLocation?.addressLine1 || "Clinic Address";
  const addressLine2 =
    primaryLocation?.city && primaryLocation?.state
      ? `${primaryLocation.city}, ${primaryLocation.state} ${primaryLocation.postalCode || ""}`
      : (primaryLocation?.city || "Practice Location");

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-xs space-y-1 font-mono text-gray-600 dark:text-gray-400">
      <p className="font-semibold text-gray-900 dark:text-white">
        {practiceName} — {officerTitle}
      </p>
      <p>{addressLine1}</p>
      <p>{addressLine2}</p>
      <p>
        Telephone: {phone}{email ? ` · Email: ${email}` : ""}
      </p>
    </div>
  );
}
