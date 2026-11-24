import { Router } from 'express';
import { AppError } from '../../common/AppError.js';
import { requireAllowedOrigin } from '../../middleware/requireAllowedOrigin.js';
import { requireDatabase } from '../../middleware/requireDatabase.js';
import { getCurrentUser, sessionCookieName } from '../auth/service/authService.js';
import { readableMedia } from './mediaService.js';

const router = Router();
router.get('/:fileId', requireDatabase, requireAllowedOrigin, async (request, response, next) => {
  let viewerId: string | undefined;
  const token = request.cookies?.[sessionCookieName];
  if (typeof token === 'string') {
    try {
      viewerId = (await getCurrentUser(token)).id;
    } catch (error) {
      if (!(error instanceof AppError && error.status === 401)) throw error;
    }
  }
  const fileId = request.params.fileId;
  const { file, stream } = await readableMedia(typeof fileId === 'string' ? fileId : '', viewerId);
  const mime = file.contentType === 'application/pdf' ? 'application/pdf' : file.contentType;
  response.set('Content-Type', mime || 'application/octet-stream');
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Cross-Origin-Resource-Policy', 'cross-origin');
  response.set('Cache-Control', 'private, max-age=300');
  if (mime === 'application/pdf') response.attachment(file.filename || 'document.pdf');
  else response.set('Content-Disposition', 'inline');
  stream.on('error', next);
  stream.pipe(response);
});
export default router;
