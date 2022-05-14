import type { NextApiRequest, NextApiResponse } from 'next';
import aws from 'aws-sdk';
import dayjs from 'dayjs';
import { Release } from '../../../lib/types';

const handler = async (
    req: NextApiRequest,
    res: NextApiResponse<{
        releases: Release[]
    }>
) => {
    aws.config.credentials = new aws.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    });
    const dynamoClient = new aws.DynamoDB();
    const dynamoResponse = await dynamoClient.query({
        TableName: 'bandcamp_release',
        KeyConditions: {
            to: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: 'revenant.jumboride@gmail.com'
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

export default handler;