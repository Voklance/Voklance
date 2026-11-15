export interface CatalogSeed {
  name: string;
  slug: string;
  category: string;
}

export const skillSeeds: CatalogSeed[] = [
  { name: 'React.js', slug: 'react-js', category: 'Frontend' },
  { name: 'JavaScript', slug: 'javascript', category: 'Programming' },
  { name: 'TypeScript', slug: 'typescript', category: 'Programming' },
  { name: 'Node.js', slug: 'node-js', category: 'Backend' },
  { name: 'Express.js', slug: 'express-js', category: 'Backend' },
  { name: 'MongoDB', slug: 'mongodb', category: 'Database' },
  { name: 'Python', slug: 'python', category: 'Programming' },
  { name: 'Artificial Intelligence', slug: 'artificial-intelligence', category: 'AI' },
  { name: 'Machine Learning', slug: 'machine-learning', category: 'AI' },
  { name: 'DevOps', slug: 'devops', category: 'Infrastructure' },
  { name: 'AWS', slug: 'aws', category: 'Cloud' }
];

export const interestSeeds: CatalogSeed[] = [
  { name: 'Frontend Development', slug: 'frontend-development', category: 'Technology' },
  { name: 'Backend Development', slug: 'backend-development', category: 'Technology' },
  { name: 'Full-Stack Development', slug: 'full-stack-development', category: 'Technology' },
  { name: 'AI and Machine Learning', slug: 'ai-and-machine-learning', category: 'Technology' },
  { name: 'Data Science', slug: 'data-science', category: 'Technology' },
  { name: 'Cybersecurity', slug: 'cybersecurity', category: 'Technology' },
  { name: 'Cloud Computing', slug: 'cloud-computing', category: 'Technology' },
  { name: 'Career Opportunities', slug: 'career-opportunities', category: 'Career' },
  { name: 'Entrepreneurship', slug: 'entrepreneurship', category: 'Business' }
];

export function catalogUpserts(seeds: CatalogSeed[]) {
  return seeds.map((seed) => ({
    updateOne: {
      filter: { slug: seed.slug },
      update: { $setOnInsert: seed },
      upsert: true
    }
  }));
}
