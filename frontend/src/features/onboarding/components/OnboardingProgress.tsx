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
  completionByStep,
  completed,
  onSelect
}: {
  step: OnboardingStep;
  completionByStep: Record<OnboardingStep, number>;
  completed: OnboardingStep[];
  onSelect: (step: OnboardingStep) => void;
}) {
  const totalCompletion = Math.round(
    Object.values(completionByStep).reduce((total, amount) => total + amount, 0) / stepNames.length
  );
  return (
    <nav aria-label="Onboarding steps" className="onboarding-progress">
      <div
        className="visually-hidden"
        role="progressbar"
        aria-label="Profile setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={totalCompletion}
        aria-valuetext={`${totalCompletion}% of onboarding filled`}
      />
      <ol>
        {stepNames.map((name, index) => {
          const number = (index + 1) as OnboardingStep;
          const selectable = number <= step || completed.includes(number);
          return (
            <li
              key={number}
              className={completionByStep[number] === 100 ? 'onboarding-progress-complete' : undefined}
            >
              <button
                type="button"
                aria-label={`${number}. ${name}`}
                aria-current={step === number ? 'step' : undefined}
                disabled={!selectable}
                onClick={() => onSelect(number)}
              >
                <span className="onboarding-progress-label">{name}</span>
                <span className="onboarding-progress-dot" aria-hidden="true" />
                <span className="onboarding-progress-track" aria-hidden="true">
                  <span
                    className="onboarding-progress-fill"
                    style={{ width: `${completionByStep[number]}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
