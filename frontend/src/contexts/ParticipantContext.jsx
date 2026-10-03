import { useMemo, useState } from "react";
import { ParticipantContext } from "./participantContextValue";

const STORAGE_KEY = "participant";

function getStoredParticipant() {
  const storedParticipant = sessionStorage.getItem(STORAGE_KEY);

  if (!storedParticipant) {
    return null;
  }

  try {
    const participant = JSON.parse(storedParticipant);

    if (!participant?.id || !participant?.code) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      id: participant.id,
      code: participant.code,
    };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function ParticipantProvider({ children }) {
  const [participant, setParticipantState] = useState(getStoredParticipant);

  function setParticipant(participantData) {
    const sessionParticipant = {
      id: participantData.id,
      code: participantData.code,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionParticipant));
    setParticipantState(sessionParticipant);
  }

  function clearParticipant() {
    sessionStorage.removeItem(STORAGE_KEY);
    setParticipantState(null);
  }

  const value = useMemo(
    () => ({
      participant,
      setParticipant,
      clearParticipant,
      hasActiveSession: Boolean(participant),
    }),
    [participant],
  );

  return (
    <ParticipantContext.Provider value={value}>
      {children}
    </ParticipantContext.Provider>
  );
}
