import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { env } from '../../config/env';
import { findOrCreateOAuthUser } from './auth.service';
import { logger } from '../../utils/logger';

export function configurePassport() {
  // Google OAuth Strategy
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${env.OAUTH_CALLBACK_URL}/google/callback`,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google profile'));
            const user = await findOrCreateOAuthUser({
              provider: 'google',
              providerUserId: profile.id,
              email,
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
    logger.info('Google OAuth strategy configured');
  } else {
    logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing');
  }

  // GitHub OAuth Strategy
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackURL: `${env.OAUTH_CALLBACK_URL}/github/callback`,
          scope: ['user:email'],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email =
              profile.emails?.find((e: any) => e.primary)?.value ?? profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from GitHub profile'));
            const user = await findOrCreateOAuthUser({
              provider: 'github',
              providerUserId: String(profile.id),
              email,
              displayName: profile.displayName ?? profile.username,
              avatarUrl: profile.photos?.[0]?.value,
            });
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
    logger.info('GitHub OAuth strategy configured');
  } else {
    logger.warn('GitHub OAuth not configured — GITHUB_CLIENT_ID/SECRET missing');
  }
}
