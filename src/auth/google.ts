import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

/** Only files the app created itself – not the rest of the user's Drive. */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface GoogleAuth {
  /** Restores an earlier sign-in without UI; returns the account email or null. */
  restore(): Promise<string | null>;
  /** Shows Google's sign-in; returns the account email, or null if the user cancelled. */
  signIn(): Promise<string | null>;
  signOut(): Promise<void>;
  /** A valid access token (refreshed by the library when needed). */
  getAccessToken(): Promise<string>;
  /** Drops a token Google rejected, so the next getAccessToken() fetches a new one. */
  invalidate(token: string): Promise<void>;
}

let configured = false;

function configure() {
  if (!configured) {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      scopes: [DRIVE_FILE_SCOPE],
    });
    configured = true;
  }
}

/** Google sign-in through @react-native-google-signin (Android account picker). */
export function createGoogleAuth(): GoogleAuth {
  return {
    async restore() {
      configure();
      if (!GoogleSignin.hasPreviousSignIn()) {
        return null;
      }
      const res = await GoogleSignin.signInSilently();
      return res.type === 'success' ? res.data.user.email : null;
    },

    async signIn() {
      configure();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try {
        const res = await GoogleSignin.signIn();
        return isSuccessResponse(res) ? res.data.user.email : null;
      } catch (e) {
        if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) {
          return null;
        }
        throw e;
      }
    },

    async signOut() {
      configure();
      await GoogleSignin.signOut();
    },

    async getAccessToken() {
      configure();
      const { accessToken } = await GoogleSignin.getTokens();
      return accessToken;
    },

    async invalidate(token) {
      await GoogleSignin.clearCachedAccessToken(token);
    },
  };
}
