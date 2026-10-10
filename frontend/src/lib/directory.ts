"use client";

import { useEffect, useState } from "react";

import { getServices, getTeamMembers, ServiceItem, TeamMember } from "@/lib/api";

interface Directory {
  /** Resolves a team member id to its display name (null when unknown). */
  providerName: (id?: string | null) => string | null;
  /** Resolves a service id to its title (null when unknown). */
  serviceName: (id?: string | null) => string | null;
  isLoading: boolean;
}

/**
 * Lightweight client-side lookup for display names that the booking API does
 * not embed in its responses. Data comes from the public team and services
 * endpoints (real database records), fetched once per mount.
 */
export function useDirectory(): Directory {
  const [providers, setProviders] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getTeamMembers(), getServices()]).then(([team, svc]) => {
      if (!isMounted) return;
      if (team.status === "fulfilled") setProviders(team.value);
      if (svc.status === "fulfilled") setServices(svc.value);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    providerName: (id) =>
      id ? providers.find((member) => member.id === id)?.displayName ?? null : null,
    serviceName: (id) => (id ? services.find((svc) => svc.id === id)?.title ?? null : null),
    isLoading,
  };
}

export default useDirectory;
