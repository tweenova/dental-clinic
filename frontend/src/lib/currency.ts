/**
 * Currency and Locale formatting utilities for Marlow Dental.
 *
 * Implements organization-configured currency (default PKR, ISO code 'PKR', symbol 'Rs')
 * and Asia/Karachi 12-hour clinic local time presentation.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  timezone: string;
}

export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: "PKR",
  symbol: "Rs",
  timezone: "Asia/Karachi",
};

/**
 * Formats a monetary price using the clinic currency symbol.
 * Handles numbers or strings (e.g. 1500, "1500", "from $140", "$140").
 * Strips hardcoded "$" or legacy currency signs and ensures the configured symbol is displayed.
 */
export function formatPrice(
  amount: number | string | null | undefined,
  symbol: string = DEFAULT_CURRENCY.symbol
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "";
  }

  const str = String(amount).trim();

  // If already formatted like "from $140" or "from 140"
  if (/^from\s+/i.test(str)) {
    const rawNum = str.replace(/^from\s+/i, "").replace(/[^\d.,]/g, "").trim();
    if (!rawNum) return `from ${symbol}`;
    return `from ${symbol} ${rawNum}`;
  }

  // If contains a number, strip any legacy $ signs
  const numericOnly = str.replace(/[^\d.,]/g, "").trim();
  if (!numericOnly) {
    return str;
  }

  // If already starts with currency symbol (like "Rs" or "PKR"), leave as is or normalize
  if (str.startsWith(symbol)) {
    return str;
  }

  // Format standard numeric amounts
  const num = parseFloat(numericOnly.replace(/,/g, ""));
  if (!isNaN(num) && Number.isFinite(num)) {
    // If integer, format without unnecessary decimal places
    const formattedNum = num.toLocaleString("en-PK", {
      maximumFractionDigits: 0,
    });
    return `${symbol} ${formattedNum}`;
  }

  return `${symbol} ${numericOnly}`;
}

/**
 * Formats a date/time into 12-hour clinic timezone (Asia/Karachi) representation (e.g., "10:30 AM").
 */
export function formatTime12(
  dateOrTime: string | Date | null | undefined,
  timezone: string = DEFAULT_CURRENCY.timezone
): string {
  if (!dateOrTime) return "";

  // If already in 12-hour string format (e.g. "10:00 AM", "4:30 PM"), return as is
  if (typeof dateOrTime === "string" && /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(dateOrTime.trim())) {
    return dateOrTime.trim().toUpperCase();
  }

  try {
    const d = typeof dateOrTime === "string" ? new Date(dateOrTime) : dateOrTime;
    if (isNaN(d.getTime())) return String(dateOrTime);

    return d.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateOrTime);
  }
}

export interface FormattedHoursLine {
  label: string;
  timeRange: string;
  isClosed: boolean;
}

/**
 * Groups and formats clinic_working_hours into clean, human-readable schedule lines.
 * Automatically groups consecutive days with identical operating hours (e.g., 'Mon – Thu: 8:00 AM – 6:00 PM').
 */
export function formatWorkingHoursSchedule(
  workingHours: Array<{
    dayOfWeek?: number;
    day_of_week?: number;
    dayName?: string;
    openTime?: string | null;
    open_time?: string | null;
    closeTime?: string | null;
    close_time?: string | null;
    isClosed?: boolean;
    is_closed?: boolean;
  }>
): FormattedHoursLine[] {
  if (!workingHours || workingHours.length === 0) return [];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const fullDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const items = [...workingHours]
    .map((h) => {
      const dow = h.dayOfWeek ?? h.day_of_week ?? 0;
      const closed = Boolean(h.isClosed ?? h.is_closed);
      const open = h.openTime ?? h.open_time;
      const close = h.closeTime ?? h.close_time;
      let timeStr = "Closed";
      if (!closed && open && close) {
        timeStr = `${formatTime12(open)} – ${formatTime12(close)}`;
      }
      return {
        dow,
        dayName: fullDayNames[dow] || `Day ${dow}`,
        shortName: dayNames[dow] || `Day ${dow}`,
        timeStr,
        isClosed: closed,
      };
    })
    .sort((a, b) => a.dow - b.dow);

  const grouped: FormattedHoursLine[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (
      j + 1 < items.length &&
      items[j + 1].timeStr === items[i].timeStr &&
      items[j + 1].dow === items[j].dow + 1
    ) {
      j++;
    }

    let label = "";
    if (i === j) {
      label = items[i].dayName;
    } else if (j === i + 1) {
      label = `${items[i].shortName}, ${items[j].shortName}`;
    } else {
      label = `${items[i].shortName} – ${items[j].shortName}`;
    }

    grouped.push({
      label,
      timeRange: items[i].timeStr,
      isClosed: items[i].isClosed,
    });
    i = j + 1;
  }

  return grouped;
}
