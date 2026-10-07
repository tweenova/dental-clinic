"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { usePublicContent } from "@/components/providers/public-content-provider";
import { fetchPublicAnnouncements, Announcement } from "@/lib/api";

export function AnnouncementMarquee() {
  const { announcements: contextAnnouncements } = usePublicContent();
  const [liveAnnouncements, setLiveAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchPublicAnnouncements()
      .then((data) => {
        if (isMounted) {
          setLiveAnnouncements(data || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLiveAnnouncements([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Prefer directly fetched fresh announcements, fallback to context
  const activeAnnouncements = (liveAnnouncements.length > 0 ? liveAnnouncements : contextAnnouncements)
    .filter((a) => a.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // If loading hasn't completed and context is empty, or no active announcements exist, render nothing (no fake text)
  if (activeAnnouncements.length === 0) {
    return null;
  }

  const items = activeAnnouncements.map((a) => a.content);
  // Duplicate list to form a seamless infinite loop
  const tickerItems = [...items, ...items];

  return (
    <div
      role="region"
      aria-label="Practice Announcements"
      className="relative z-30 w-full overflow-hidden bg-white/90 dark:bg-black/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 py-2.5 text-xs select-none"
    >
      <div className="flex w-full overflow-hidden">
        <motion.div
          className="flex shrink-0 items-center gap-12 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: Math.max(25, tickerItems.length * 8),
          }}
        >
          {tickerItems.map((text, idx) => (
            <div
              key={`${idx}-${text}`}
              className="inline-flex items-center gap-3 text-black dark:text-white text-[12.5px] font-medium tracking-wide"
            >
              <span className="text-primary font-bold text-xs">✦</span>
              <span>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default AnnouncementMarquee;
