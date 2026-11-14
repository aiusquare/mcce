export type ContactEntryEligibility = {
  freshContact: number;
  directEntryContact: number;
  entryMode?: "fresh" | "direct_entry";
};

const startYear = (value: unknown): number | null => {
  const match = String(value || "").match(/(\d{4})/);
  return match ? Number(match[1]) : null;
};

const contactNumber = (value: unknown): number | null => {
  const match = String(value || "").match(/contact\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/**
 * Academic sessions are teaching years, not admission cohorts.  The first
 * configured year has fresh entrants in Contact 1 and Direct Entry students in
 * Contact 2; each following session advances both contacts by one.
 */
export function resolveContactEntryEligibility(
  sessions: any[],
  sessionId: string,
  semesterId: string,
): ContactEntryEligibility | null {
  const selected = sessions.find((session) => String(session.id) === String(sessionId));
  const selectedYear = startYear(selected?.name || sessionId);
  const selectedContact = contactNumber(semesterId);
  const years = sessions.map((session) => startYear(session.name)).filter((year): year is number => year !== null);

  if (selectedYear === null || selectedContact === null || years.length === 0) return null;

  const freshContact = selectedYear - Math.min(...years) + 1;
  const directEntryContact = freshContact + 1;
  return {
    freshContact,
    directEntryContact,
    entryMode:
      selectedContact === freshContact
        ? "fresh"
        : selectedContact === directEntryContact
          ? "direct_entry"
          : undefined,
  };
}

export function allowedContactChoices(sessions: any[], sessionId: string) {
  const selected = sessions.find((session) => String(session.id) === String(sessionId));
  const selectedYear = startYear(selected?.name || sessionId);
  const years = sessions.map((session) => startYear(session.name)).filter((year): year is number => year !== null);

  const freshContact =
    selectedYear !== null && years.length > 0
      ? selectedYear - Math.min(...years) + 1
      : null;

  const maxContact = Math.max(6, freshContact ? freshContact + 1 : 6);
  const choices = [];
  for (let i = 1; i <= maxContact; i++) {
    let suffix = "";
    if (freshContact !== null) {
      if (i === freshContact) suffix = " — Fresh entrants";
      else if (i === freshContact + 1) suffix = " — Direct Entry";
    }
    choices.push({
      number: i,
      label: `Contact ${i}${suffix}`,
    });
  }
  return choices;
}
