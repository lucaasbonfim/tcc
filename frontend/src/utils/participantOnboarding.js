export function getParticipantNextRoute(onboarding) {
  if (!onboarding.consent_confirmed) {
    return "/consent";
  }

  if (!onboarding.profile_completed) {
    return "/profile";
  }

  return "/experiment";
}
