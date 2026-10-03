import { useContext } from "react";
import { ParticipantContext } from "./participantContextValue";

export function useParticipant() {
  const context = useContext(ParticipantContext);

  if (!context) {
    throw new Error("useParticipant deve ser usado dentro de ParticipantProvider.");
  }

  return context;
}
