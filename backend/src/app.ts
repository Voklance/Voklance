import { API_V1_PREFIX } from '@voklance/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AppError } from './common/AppError.js';
import { isAllowedOrigin } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './modules/auth/routes/authRoutes.js';
import healthRoutes from './modules/health/routes/healthRoutes.js';
import { interestCatalogRoutes, userInterestRoutes } from './modules/interests/routes/interestRoutes.js';
import onboardingRoutes from './modules/onboarding/routes/onboardingRoutes.js';
import profileRoutes from './modules/profiles/routes/profileRoutes.js';
import { educationRoutes, experienceRoutes } from './modules/profiles/routes/historyRoutes.js';
import { skillCatalogRoutes, userSkillRoutes } from './modules/skills/routes/skillRoutes.js';
import postRoutes, { bookmarkRoutes as legacyPostBookmarkRoutes } from './modules/posts/routes/postRoutes.js';
import communityRoutes, { myCommunityRoutes } from './modules/communities/routes/communityRoutes.js';
import commandRoutes from './modules/commands/routes/commandRoutes.js';
import referralRoutes, { communityReferralRoutes } from './modules/referrals/routes/referralRoutes.js';
import { eventRoutes, communityEventRoutes } from './modules/events/routes/eventRoutes.js';
import { resourceRoutes, communityResourceRoutes } from './modules/resources/routes/resourceRoutes.js';
import {
  connectionRoutes,
  professionalDiscoveryRoutes
} from './modules/connections/routes/connectionRoutes.js';
import {
  conversationRoutes,
  messageReportRoutes,
  userBlockRoutes
} from './modules/messaging/routes/messagingRoutes.js';
import notificationRoutes from './modules/notifications/routes/notificationRoutes.js';
import githubRoutes from './modules/github/routes/githubRoutes.js';
import searchRoutes from './modules/search/routes/searchRoutes.js';
import recommendationRoutes, { feedRoutes } from './modules/recommendations/routes/recommendationRoutes.js';
import settingsRoutes from './modules/settings/routes/settingsRoutes.js';
import bookmarkRoutes, { collectionRoutes } from './modules/bookmarks/routes/bookmarkRoutes.js';
import activityRoutes from './modules/bookmarks/routes/activityRoutes.js';
import portfolioRoutes from './modules/profiles/routes/portfolioRoutes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) callback(null, true);
      else callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.'));
    }
  })
);
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(requestLogger);

app.use(`${API_V1_PREFIX}/health`, healthRoutes);
app.use(`${API_V1_PREFIX}/auth`, authRoutes);
app.use(`${API_V1_PREFIX}/profiles`, profileRoutes);
app.use(`${API_V1_PREFIX}/skills`, skillCatalogRoutes);
app.use(`${API_V1_PREFIX}/users/me/skills`, userSkillRoutes);
app.use(`${API_V1_PREFIX}/interests`, interestCatalogRoutes);
app.use(`${API_V1_PREFIX}/users/me/interests`, userInterestRoutes);
app.use(`${API_V1_PREFIX}/users/me/experiences`, experienceRoutes);
app.use(`${API_V1_PREFIX}/users/me/educations`, educationRoutes);
app.use(`${API_V1_PREFIX}/onboarding`, onboardingRoutes);
app.use(`${API_V1_PREFIX}/posts`, postRoutes);
app.use(`${API_V1_PREFIX}/users/me/bookmarks`, legacyPostBookmarkRoutes);
app.use(`${API_V1_PREFIX}/communities`, commandRoutes);
app.use(`${API_V1_PREFIX}/communities`, communityEventRoutes);
app.use(`${API_V1_PREFIX}/communities`, communityResourceRoutes);
app.use(`${API_V1_PREFIX}/communities`, communityReferralRoutes);
app.use(`${API_V1_PREFIX}/communities`, communityRoutes);
app.use(`${API_V1_PREFIX}/referrals`, referralRoutes);
app.use(`${API_V1_PREFIX}/events`, eventRoutes);
app.use(`${API_V1_PREFIX}/resources`, resourceRoutes);
app.use(`${API_V1_PREFIX}/connections`, connectionRoutes);
app.use(`${API_V1_PREFIX}/professionals`, professionalDiscoveryRoutes);
app.use(`${API_V1_PREFIX}/conversations`, conversationRoutes);
app.use(`${API_V1_PREFIX}/messages`, messageReportRoutes);
app.use(`${API_V1_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_V1_PREFIX}/github`, githubRoutes);
app.use(`${API_V1_PREFIX}/search`, searchRoutes);
app.use(`${API_V1_PREFIX}/feed`, feedRoutes);
app.use(`${API_V1_PREFIX}/recommendations`, recommendationRoutes);
app.use(`${API_V1_PREFIX}/settings`, settingsRoutes);
app.use(`${API_V1_PREFIX}/bookmarks`, bookmarkRoutes);
app.use(`${API_V1_PREFIX}/collections`, collectionRoutes);
app.use(`${API_V1_PREFIX}/me/activity`, activityRoutes);
app.use(`${API_V1_PREFIX}/me/profile`, portfolioRoutes);
app.use(`${API_V1_PREFIX}/users`, userBlockRoutes);
app.use(`${API_V1_PREFIX}/users/me/communities`, myCommunityRoutes);

// Temporary aliases keep existing local clients working during the v1 migration.
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
