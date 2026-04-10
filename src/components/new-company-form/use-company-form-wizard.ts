import { useMemo, useState } from "react";

export function useCompanyFormWizard(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasVisitedContactStep, setHasVisitedContactStep] = useState(false);
  const maxStepIndex = Math.max(totalSteps - 1, 0);

  const isLastStep = useMemo(
    () => currentStep === maxStepIndex,
    [currentStep, maxStepIndex],
  );

  return {
    currentStep,
    setCurrentStep,
    hasVisitedContactStep,
    setHasVisitedContactStep,
    isLastStep,
  };
}
