import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule an Appointment | Marlow Dental",
  description:
    "Request an appointment at Marlow Dental. Pick your preferred service, date, and time. Itemized written estimates before treatment.",
  openGraph: {
    title: "Schedule an Appointment | Marlow Dental",
    description:
      "Request an appointment at Marlow Dental. Same-week openings for new patients.",
  },
};

/**
 * Layout wrapper providing search-engine metadata specifically tailored for the appointment booking route.
 */
export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
