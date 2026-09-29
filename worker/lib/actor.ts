// The name recorded against every change in the banner and staff sections.
// Self-entered (the site has one shared password), trimmed and capped.
export function validActor(actor: unknown): string | null {
  if (typeof actor !== "string") return null;
  const trimmed = actor.trim();
  return trimmed && trimmed.length <= 60 ? trimmed : null;
}

export const ACTOR_REQUIRED = "Enter your name so the change is recorded";
