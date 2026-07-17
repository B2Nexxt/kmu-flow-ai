import { MandantenOnboardingProvider } from "./mandanten-onboarding-context";

export default function MandantenNeuLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MandantenOnboardingProvider>{children}</MandantenOnboardingProvider>;
}
