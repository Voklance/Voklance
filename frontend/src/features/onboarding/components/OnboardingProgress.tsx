import type { OnboardingStep } from '@voklance/shared';

export const stepNames = [
  'Your profile',
  'Professional status',
  'Skills',
  'Experience & education',
  'Interests',
  'Review'
] as const;

export default function OnboardingProgress({
  step,
  completed,
  onSelect
}: {
  step: OnboardingStep;
  completed: OnboardingStep[];
  onSelect: (step: OnboardingStep) => void;
}) {
  return (
    <nav aria-label="Onboarding steps" className="onboarding-progress">
      <ol>
        {stepNames.map((name, index) => {
          const number = (index + 1) as OnboardingStep;
          const selectable = number <= step || completed.includes(number);
          return (
            <li key={number}>
              <button
                type="button"
                aria-label={`${number}. ${name}`}
                aria-current={step === number ? 'step' : undefined}
                disabled={!selectable}
                onClick={() => onSelect(number)}
              >
                <span className="progress-number">{number}</span>
                <span>{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
