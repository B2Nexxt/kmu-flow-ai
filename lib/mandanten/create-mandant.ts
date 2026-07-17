import type { MandantenOnboardingData } from "@/app/admin/mandanten/neu/mandanten-onboarding-context";
import { createMandantAction } from "@/app/admin/mandanten/neu/actions/create-mandant-action";

export class CreateMandantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateMandantError";
  }
}

export async function createMandant(
  data: MandantenOnboardingData,
): Promise<{ mandantenId: string }> {
  const result = await createMandantAction(data);

  if (!result.success) {
    throw new CreateMandantError(result.error);
  }

  return { mandantenId: result.mandantenId };
}
