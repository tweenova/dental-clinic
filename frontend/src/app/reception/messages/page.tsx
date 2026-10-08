"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  Filter,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  User,
  X,
} from "lucide-react";

import {
  getReceptionMessages,
  ReceptionMessage,
  searchReceptionPatients,
  sendReceptionMessage,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionMessagesPage() {
  const { accessToken } = useAuth();

  const [messages, setMessages] = useState<ReceptionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("");

  // New Message Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Array<{ id: string; fullName: string; phone: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [channel, setChannel] = useState<"sms" | "email" | "portal" | "whatsapp">("sms");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionMessages(
        { channel: channelFilter || undefined },
        accessToken
      );
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [channelFilter, accessToken]);

  const handlePatientSearch = async (query: string) => {
    setPatientSearch(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const res = await searchReceptionPatients({ search: query, limit: 5 }, accessToken);
      setPatientResults(res.items.map((p) => ({ id: p.id, fullName: p.fullName, phone: p.phone })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setIsSending(true);
    try {
      await sendReceptionMessage(
        {
          patientId: selectedPatientId || undefined,
          channel,
          recipient: recipient || undefined,
          subject: subject || undefined,
          body,
          isInternalNote,
        },
        accessToken
      );
      setIsModalOpen(false);
      setSelectedPatientId("");
      setPatientSearch("");
      setBody("");
      setSubject("");
      setRecipient("");
      await loadMessages();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to log message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Practice Communications Center
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Log patient outbound messages, staff reminders, SMS records, and internal chart notes.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Message / Log</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[
            { id: "", label: "All Channels" },
            { id: "sms", label: "SMS" },
            { id: "email", label: "Email" },
            { id: "portal", label: "Portal" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setChannelFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                channelFilter === tab.id
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading communication log...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Inbox className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No communication records found
            </p>
            <p className="text-xs text-gray-500">Click &quot;New Message / Log&quot; to create a log entry.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {messages.map((m) => (
              <div
                key={m.id}
                className="p-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        px-2 py-0.5 rounded-md font-mono uppercase text-[10px] font-bold
                        ${
                          m.isInternalNote
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                            : m.channel === "sms"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }
                      `}
                    >
                      {m.isInternalNote ? "Internal Note" : `${m.channel} · ${m.direction}`}
                    </span>
                    {m.patientName && (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Patient: {m.patientName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                  </span>
                </div>

                {m.subject && (
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    Subject: {m.subject}
                  </p>
                )}

                <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Log Message or Internal Note
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">
                  Search Patient (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Type name or phone..."
                  value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                />
                {patientResults.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-1 max-h-32 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setPatientSearch(`${p.fullName} (${p.phone})`);
                          setPatientResults([]);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 flex justify-between"
                      >
                        <span>{p.fullName}</span>
                        <span className="font-mono text-gray-400">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as "sms" | "email" | "portal" | "whatsapp")}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="portal">Portal</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600"
                    />
                    <span>Internal Note Only</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Message Content *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter message text or note..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                />
              </div>

              <p className="text-[11px] text-gray-400 italic">
                Note: Logging records internal message activity into the patient chart and staff audit logs.
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  {isSending ? "Saving..." : "Save Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
