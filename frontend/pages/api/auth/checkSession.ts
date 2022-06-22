import type { NextApiRequest, NextApiResponse } from 'next';
import { withSession } from '../../../lib/utils/session';
import { IronSessionData } from 'iron-session';
import { User } from '../../../lib/types';

const handler = async (
    req: NextApiRequest,
    res: NextApiResponse<{ user: User }>
) => {
    try {
        const { user } = req.session as IronSessionData;
        if (user) {
            const { email, } = user;
            if (!email) { res.status(401).end(); return; }
            res.json({ user: { email }, });
        } else {
            throw Error();
        }
    } catch (error) {
        res.status(401).end();
    }
}

export default withSession(handler);