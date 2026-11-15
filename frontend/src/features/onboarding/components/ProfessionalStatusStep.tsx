import { PROFESSIONAL_STATUSES, type ProfessionalStatus } from '@voklance/shared';

const labels: Record<ProfessionalStatus, string> = {
  STUDENT: 'Student',
  WORKING_PROFESSIONAL: 'Working professional',
  FREELANCER: 'Freelancer',
  FOUNDER: 'Founder',
  RECRUITER: 'Recruiter',
  EDUCATOR: 'Educator',
  OTHER: 'Other'
};
export { labels as professionalStatusLabels };

export default function ProfessionalStatusStep({
  value,
  onChange,
  error
}: {
  value: ProfessionalStatus | '';
  onChange: (value: ProfessionalStatus) => void;
  error?: string;
}) {
  return (
    <fieldset className="onboarding-options">
      <legend>Which best describes you now?</legend>
      <div className="onboarding-option-grid">
        {PROFESSIONAL_STATUSES.map((status) => (
          <label className="onboarding-option" key={status}>
            <input
              type="radio"
              name="professionalStatus"
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
            />
            <span>{labels[status]}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="onboarding-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
