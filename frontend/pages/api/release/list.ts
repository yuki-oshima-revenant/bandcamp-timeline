import type { NextApiRequest, NextApiResponse } from 'next';
import dayjs from 'dayjs';
import { Release } from '../../../lib/types';
import { getDynamoDBClient } from '../../../lib/utils/aws';
import { withSession } from '../../../lib/utils/session';
import { IronSessionData } from 'iron-session';

const handler = async (
    req: NextApiRequest,
    res: NextApiResponse<{
        releases: Release[]
    }>
) => {
    const { user } = req.session as IronSessionData;
    if (!user || !user.email) {
        res.status(401).end();
        return;
    }
    const dynamoClient = getDynamoDBClient();
    const dynamoResponse = await dynamoClient.query({
        TableName: 'bandcamp_release',
        KeyConditions: {
            to: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: user.email
                }]
            }
        }
    }).promise();
    const items = dynamoResponse.Items;
    if (!items) {
        res.status(200).json({ releases: [] });
        return;
    }
    const releases: Release[] = items.map((item) => {
        return {
            artist: item['artist'].S || null,
            date: item['date'].S || null,
            label: item['label'].S || null,
            link: item['link'].S || null,
            coverLink: item['cover_link'].S || null,
            title: item['title'].S || null,
        }
    }).sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
    res.status(200).json({ releases })
};

export default withSession(handler);