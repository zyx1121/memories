import type { DefaultSession, NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

declare module "next-auth" {
    interface Session extends DefaultSession {
        user?: {
            id?: string;
            isAllowedUploader?: boolean;
        } & DefaultSession["user"]
    }
}

const allowedUploadersString = process.env.ALLOWED_UPLOADERS || "";
export const ALLOWED_UPLOADERS = allowedUploadersString.split(',').map(email => email.trim());

export const authOptions: NextAuthOptions = {
    providers: [
        GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_ID!,
            clientSecret: process.env.GOOGLE_SECRET!
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async session({ session }) {
            if (session.user) {
                session.user.isAllowedUploader = ALLOWED_UPLOADERS.includes(session.user.email || "");
            }
            return session;
        },
    },
}
