import { withIronSessionApiRoute } from "iron-session/next";
import type { NextApiHandler } from 'next';

export const withSession = <T>(route: NextApiHandler<T>): NextApiHandler<T> => {
    return withIronSessionApiRoute(
        route,
        {
            cookieName: "bandcamp-timeline_session",
            password: process.env.COOKIE_PASSWORD || '',
            cookieOptions: {
                secure: process.env.NODE_ENV === "production",
                httpOnly: true,
            },
            ttl: 60 * 60 * 24 * 1000
        },
    )
};