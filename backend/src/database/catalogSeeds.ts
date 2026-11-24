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
  { name: 'AWS', slug: 'aws', category: 'Cloud' },
  ...Object.entries({
    Programming: [
      'Java',
      'C',
      'C++',
      'C#',
      'Go',
      'Rust',
      'Ruby',
      'PHP',
      'Kotlin',
      'Swift',
      'Dart',
      'Scala',
      'R',
      'Bash',
      'PowerShell',
      'SQL',
      'HTML',
      'CSS',
      'Sass'
    ],
    Frontend: [
      'Angular',
      'Vue.js',
      'Next.js',
      'Svelte',
      'React Native',
      'Tailwind CSS',
      'Bootstrap',
      'Redux',
      'Web Accessibility',
      'Web Performance'
    ],
    Backend: [
      'NestJS',
      'Django',
      'Flask',
      'FastAPI',
      'Spring Boot',
      'Laravel',
      'Ruby on Rails',
      'GraphQL',
      'REST API Design',
      'Microservices',
      'API Development'
    ],
    Database: [
      'PostgreSQL',
      'MySQL',
      'Redis',
      'SQLite',
      'Microsoft SQL Server',
      'Oracle Database',
      'Elasticsearch',
      'DynamoDB',
      'Firebase'
    ],
    Cloud: ['Microsoft Azure', 'Google Cloud Platform', 'Cloud Architecture', 'Serverless Computing'],
    Infrastructure: [
      'Docker',
      'Kubernetes',
      'Terraform',
      'CI/CD',
      'Git',
      'GitHub Actions',
      'Linux',
      'System Administration',
      'Site Reliability Engineering',
      'Infrastructure as Code',
      'Ansible',
      'Jenkins'
    ],
    Data: [
      'Data Analysis',
      'Data Science',
      'Data Engineering',
      'Data Visualization',
      'Power BI',
      'Tableau',
      'Microsoft Excel',
      'Pandas',
      'NumPy',
      'Apache Spark',
      'ETL',
      'Business Intelligence'
    ],
    AI: [
      'Deep Learning',
      'Natural Language Processing',
      'Computer Vision',
      'Generative AI',
      'Prompt Engineering',
      'PyTorch',
      'TensorFlow',
      'MLOps',
      'Large Language Models'
    ],
    Cybersecurity: [
      'Network Security',
      'Application Security',
      'Penetration Testing',
      'Threat Modeling',
      'Incident Response',
      'Identity and Access Management',
      'Security Auditing'
    ],
    Design: [
      'UI Design',
      'UX Design',
      'Figma',
      'User Research',
      'Prototyping',
      'Design Systems',
      'Graphic Design',
      'Adobe Photoshop',
      'Adobe Illustrator',
      'Motion Design'
    ],
    Product: [
      'Product Management',
      'Product Roadmapping',
      'Agile',
      'Scrum',
      'User Stories',
      'Market Research',
      'A/B Testing',
      'Stakeholder Management'
    ],
    Business: [
      'Business Development',
      'Strategic Planning',
      'Project Management',
      'Operations Management',
      'Process Improvement',
      'Vendor Management',
      'Negotiation',
      'Entrepreneurship'
    ],
    Marketing: [
      'Digital Marketing',
      'SEO',
      'SEM',
      'Content Marketing',
      'Social Media Marketing',
      'Email Marketing',
      'Brand Strategy',
      'Copywriting',
      'Marketing Analytics'
    ],
    Sales: [
      'Sales',
      'Account Management',
      'CRM',
      'Salesforce',
      'Lead Generation',
      'Customer Success',
      'Customer Support'
    ],
    Finance: [
      'Financial Analysis',
      'Financial Modeling',
      'Accounting',
      'Bookkeeping',
      'Budgeting',
      'Forecasting',
      'Taxation',
      'Risk Management',
      'Investment Analysis'
    ],
    'Human Resources': [
      'Recruiting',
      'Talent Acquisition',
      'Employee Relations',
      'Learning and Development',
      'Performance Management',
      'Payroll',
      'HR Analytics'
    ],
    Professional: [
      'Public Speaking',
      'Technical Writing',
      'Presentation Design',
      'Leadership',
      'Team Management',
      'Collaboration',
      'Problem Solving',
      'Critical Thinking',
      'Time Management'
    ],
    Engineering: [
      'AutoCAD',
      'MATLAB',
      'Mechanical Design',
      'Electrical Engineering',
      'Civil Engineering',
      'Quality Assurance',
      'Test Automation',
      'Selenium',
      'Cypress',
      'Playwright',
      'Mobile App Development'
    ]
  }).flatMap(([category, names]) =>
    names.map((name) => ({
      name,
      slug: name
        .replace(/C\+\+/g, 'C Plus Plus')
        .replace(/C#/g, 'C Sharp')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      category
    }))
  )
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
  { name: 'Entrepreneurship', slug: 'entrepreneurship', category: 'Business' },
  ...Object.entries({
    Technology: [
      'Mobile App Development',
      'Web Development',
      'Game Development',
      'Open Source',
      'DevOps',
      'Site Reliability Engineering',
      'Software Architecture',
      'API Development',
      'Blockchain',
      'Internet of Things',
      'Robotics',
      'Augmented Reality',
      'Virtual Reality',
      'Quantum Computing',
      'Privacy Engineering',
      'Quality Assurance',
      'Test Automation'
    ],
    'Data and AI': [
      'Data Analytics',
      'Data Engineering',
      'Data Visualization',
      'Business Intelligence',
      'Generative AI',
      'Natural Language Processing',
      'Computer Vision',
      'MLOps',
      'Responsible AI'
    ],
    Design: [
      'UI Design',
      'UX Design',
      'Graphic Design',
      'Product Design',
      'User Research',
      'Design Systems',
      'Accessibility',
      'Motion Design',
      'Industrial Design',
      'Architecture'
    ],
    Business: [
      'Startups',
      'Product Management',
      'Project Management',
      'Business Development',
      'Operations',
      'Strategy',
      'Leadership',
      'Consulting',
      'E-commerce',
      'Customer Success',
      'Sales'
    ],
    Career: [
      'Professional Networking',
      'Mentorship',
      'Career Development',
      'Job Search',
      'Internships',
      'Freelancing',
      'Remote Work',
      'Public Speaking',
      'Personal Branding',
      'Interview Preparation',
      'Workplace Culture'
    ],
    Marketing: [
      'Digital Marketing',
      'Content Marketing',
      'Social Media Marketing',
      'Search Engine Optimization',
      'Branding',
      'Growth Marketing',
      'Market Research',
      'Public Relations'
    ],
    Finance: [
      'Personal Finance',
      'Financial Technology',
      'Investing',
      'Accounting',
      'Financial Planning',
      'Venture Capital',
      'Economics'
    ],
    Engineering: [
      'Mechanical Engineering',
      'Electrical Engineering',
      'Civil Engineering',
      'Aerospace Engineering',
      'Manufacturing',
      'Renewable Energy',
      'Automotive Technology'
    ],
    Science: [
      'Scientific Research',
      'Biotechnology',
      'Environmental Science',
      'Space Exploration',
      'Mathematics',
      'Physics'
    ],
    Healthcare: [
      'Digital Health',
      'Public Health',
      'Mental Health',
      'Healthcare Innovation',
      'Medical Research',
      'Nutrition'
    ],
    Creative: [
      'Writing',
      'Photography',
      'Filmmaking',
      'Animation',
      'Music Production',
      'Podcasting',
      'Content Creation'
    ],
    Education: [
      'Teaching',
      'Online Learning',
      'EdTech',
      'Skill Development',
      'Academic Research',
      'Language Learning'
    ],
    Community: [
      'Community Building',
      'Volunteering',
      'Social Impact',
      'Diversity and Inclusion',
      'Nonprofit Work',
      'Sustainability'
    ]
  }).flatMap(([category, names]) =>
    names.map((name) => ({
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      category
    }))
  )
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
