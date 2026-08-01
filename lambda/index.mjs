import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront'
import { createHandler } from './handler.mjs'

const s3 = new S3Client({})
const cloudfront = new CloudFrontClient({})

export const handler = createHandler({
  putObject: (key, body) =>
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.CONFIG_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300',
      }),
    ),
  invalidate: (callerReference) =>
    cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: process.env.DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: { Quantity: 1, Items: ['/config/*'] },
        },
      }),
    ),
})
