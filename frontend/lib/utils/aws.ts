import aws from 'aws-sdk';

export const getDynamoDBClient = () => {
    aws.config.credentials = new aws.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID_DYNAMO || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_DYNAMO || '',
    });
    aws.config.region = 'ap-northeast-1'
    return new aws.DynamoDB();
}