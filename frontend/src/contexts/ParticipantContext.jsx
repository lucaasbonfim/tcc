import { useEffect, useMemo, useState } from "react";
import {
  getAuthenticatedSession,
  logoutSession,
} from "../services/auth.service";
import { ParticipantContext } from "./participantContextValue";

export function ParticipantProvider({ children }) {
  const [participant, setParticipantState] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentSession() {
      try {
        const session = await getAuthenticatedSession();

        if (isMounted && session.role === "participant") {
          setParticipantState(session.participant);
        }
      } catch {
        if (isMounted) {
          setParticipantState(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    loadCurrentSession();

    return () => {
      isMounted = false;
    };
  }, []);

  function setParticipant(participantData) {
    setParticipantState({
      id: participantData.id,
      code: participantData.code,
    });
  }

  async function clearParticipant() {
    try {
      await logoutSession();
    } finally {
      setParticipantState(null);
    }
  }

  const value = useMemo(
    () => ({
      participant,
      setParticipant,
      clearParticipant,
      isLoadingSession,
      hasActiveSession: Boolean(participant),
    }),
    [isLoadingSession, participant],
  );

  return (
    <ParticipantContext.Provider value={value}>
      {children}
    </ParticipantContext.Provider>
  );
}
