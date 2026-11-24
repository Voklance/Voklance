import type { CatalogItem } from '@voklance/shared';
import devicons from 'devicon/devicon.json';

const aliases: Record<string, string> = {
  'react-js': 'react',
  'react-native': 'react',
  'node-js': 'nodejs',
  'express-js': 'express',
  aws: 'amazonwebservices',
  'microsoft-azure': 'azure',
  'google-cloud-platform': 'googlecloud',
  'spring-boot': 'spring',
  'ruby-on-rails': 'rails',
  html: 'html5',
  css: 'css3',
  'adobe-photoshop': 'photoshop',
  'adobe-illustrator': 'illustrator',
  cypress: 'cypressio'
};

const variants = new Map(devicons.map((icon) => [icon.name, icon.versions.font]));

export default function SkillIcon({ skill }: { skill: Pick<CatalogItem, 'slug'> }) {
  const name = aliases[skill.slug] ?? skill.slug.replace(/-/g, '');
  const fonts = variants.get(name) ?? [];
  const variant = fonts.includes('original')
    ? 'original'
    : fonts.includes('plain')
      ? 'plain'
      : fonts.find((font) => !font.endsWith('wordmark'));

  if (variant)
    return <i className={`devicon-${name}-${variant} colored`} aria-hidden="true" />;

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" />
    </svg>
  );
}
