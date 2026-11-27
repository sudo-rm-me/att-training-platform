/**
 * Display name of the platform. APP_NAME is read at runtime (so the public
 * container image can be rebranded with an env var); NEXT_PUBLIC_APP_NAME is
 * the older build-time setting.
 */
export const APP_NAME = process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "Academy";
