import type { NextApiRequest, NextApiResponse } from 'next';
import { Release } from '../../../lib/types';
import { withSession } from '../../../lib/utils/session';
import { IronSessionData } from 'iron-session';

const handler = async (
    req: NextApiRequest,
    res: NextApiResponse<{
        releases: Release[]
    }>
) => {
    try {
        const { user } = req.session as IronSessionData;
        if (user) {
            req.session.destroy();
            res.status(200).end();
        } else {
            throw Error();
        }
    } catch (error) {
        res.status(401).end();
    }
}

export default withSession(handler);