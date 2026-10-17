"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, User, Users } from "lucide-react";

import { DoctorPatientSummary, searchDoctorPatients } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DoctorPatientsPage() {
  const { accessToken } = useAuth();

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPatients = async (query = search) => {
    setIsLoading(true);
    try {
      const data = await searchDoctorPatients(query, accessToken);
      setPatients(data);
    } catch (err) {
      console.error("Failed to load doctor patients:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadPatients();
    });
  }, [accessToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPatients(search);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow mb-1">Clinician Workspace</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Patient Clinical Records
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Search patient records, view visit histories, and access dental charts.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
            <input
              type="text"
              placeholder="Search patients by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-cream border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-ink placeholder:text-ink-soft"
            />
          </div>
          <Button variant="primary" size="md" type="submit">
            Search
          </Button>
          {search && (
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => {
                setSearch("");
                loadPatients("");
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Patients Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-ink-soft font-mono">
            Loading patient records...
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-ink-soft/40 mx-auto" />
            <p className="text-sm font-medium text-ink">No patients found</p>
            <p className="text-xs text-ink-soft max-w-sm mx-auto">
              {search
                ? `No clinical records matching "${search}". Try searching by another name or phone number.`
                : "No patients currently registered in the clinic database."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand/40 border-b border-line text-ink-soft uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Date of Birth</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-sand/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                          {p.firstName?.[0] || <User className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{p.fullName}</p>
                          <p className="text-[11px] text-ink-soft font-mono">
                            ID: {p.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink font-mono">{p.phone}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{p.email || "—"}</td>
                    <td className="px-5 py-3.5 text-ink-soft font-mono">
                      {p.dateOfBirth || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/doctor/patients/${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium transition-colors"
                      >
                        <span>Open Record</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
