import type { NextApiRequest, NextApiResponse } from 'next';
import { Release, User } from '../../../lib/types';
import argon2 from 'argon2';
import { getDynamoDBClient } from '../../../lib/utils/aws';
import { withSession } from '../../../lib/utils/session';
import { IronSessionData } from 'iron-session';

const handler = async (
    req: NextApiRequest,
    res: NextApiResponse<{
        user: User
    }>
) => {
    const { email, password } = req.body as { email?: string, password?: string };
    if (!email || !password) {
        res.status(400).end();
        return;
    }
    const dynamoClient = getDynamoDBClient();
    const dynamoResponse = await dynamoClient.query({
        TableName: 'bandcamp-timeline_user',
        KeyConditions: {
            email: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: email
                }]
            }
        }
    }).promise();
    const items = dynamoResponse.Items;
    if (!items || items.length === 0) {
        res.status(401).end();
        return;
    }
    const users = items.map((item) => {
        return {
            email: item['email'].S || null,
            password_hash: item['password_hash'].S || null,
        }
    })
    if (users.length === 0) {
        res.status(500).end();
        return;
    }
    const password_hash = users[0].password_hash;
    if (!password_hash) {
        res.status(500).end();
        return;
    }
    const result = await argon2.verify(password_hash, password, { salt: Buffer.from(process.env.PASSWORD_SALT || '') });
    if (result) {
        (req.session as IronSessionData).user = {
            email,
        };
        await req.session.save();
        res.status(200).json({ user: { email } });
    } else {
        res.status(401).end();
    }

}

export default withSession(handler);