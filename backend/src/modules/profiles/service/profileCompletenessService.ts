import type { ProfileCompleteness } from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import Profile from '../model/Profile.js';
import ProfessionalExperience from '../model/ProfessionalExperience.js';
import Education from '../model/Education.js';
import ProfileCertification from '../model/ProfileCertification.js';
import ProfileProject from '../model/ProfileProject.js';
import UserSkill from '../../skills/model/UserSkill.js';

export async function profileCompleteness(userId: string): Promise<ProfileCompleteness> {
  const [profile, experiences, education, skills, projects, certifications] = await Promise.all([
    Profile.findOne({ userId }).select('fullName country headline bio').lean(),
    ProfessionalExperience.exists({ userId }),
    Education.exists({ userId }),
    UserSkill.exists({ userId }),
    ProfileProject.exists({ userId }),
    ProfileCertification.exists({ userId })
  ]);
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  const sections = [
    ['Basic profile', !!profile.fullName && !!profile.country, 20],
    ['Headline', !!profile.headline, 15],
    ['About', !!profile.bio && profile.bio.trim().length >= 30, 10],
    ['Experience', !!experiences, 15],
    ['Skills', !!skills, 15],
    ['Education', !!education, 10],
    ['Projects', !!projects, 10],
    ['Certifications', !!certifications, 5]
  ] as const;
  return {
    percentage: sections.reduce((sum, [, done, weight]) => sum + (done ? weight : 0), 0),
    completedSections: sections.filter(([, done]) => done).map(([name]) => name),
    suggestedSections: sections.filter(([, done]) => !done).map(([name]) => name)
  };
}
