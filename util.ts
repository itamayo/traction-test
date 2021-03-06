import * as crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { Db } from "mongodb";
import * as aws from "aws-sdk";

const { BUCKET_NAME, ETS_PIPELINE } = process.env;

export function hashPassword(password: string) {
  if (!password) {
    password = "";
  }

  const sha265 = crypto.createHash("sha256");
  return sha265.update(password).digest("base64");
}

export function generateAuthToken() {
  return crypto.randomBytes(30).toString('hex');
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isLoggedIn(req)) {
    next();
  } else {
    res.status(401);
    res.send({
      status: "ERR",
      message: "Authorisation required"
    });
  }
}

export function isLoggedIn(req: Request): boolean {
  return req.session && req.session.loggedIn;
}

export function getDatabase(req: Request): Promise<Db> {
  const db: Db = req.app.locals.db;

  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
    } else {
      reject("Could not retrieve database client object");
    }
  });
}

export function uploadToS3(filename: string, file: aws.S3.Body, bucket = BUCKET_NAME!): Promise<void> {
  const s3 = new aws.S3();

  return new Promise((resolve, reject) => {
    s3.upload({
      Bucket: bucket, Key: filename, Body: file
    }, {
      partSize: 5 * 1024 * 1024, queueSize: 10
    }, (err, data) => {
      if (err) {
        console.error("ERROR:", err);
        reject(err);
      } else {
        console.log(data);
        resolve();
      }
    });
  })
}

export function encodeDash(input: string): Promise<void> {
  const inputBasename = input.split(".")[0];

  const params = {
    PipelineId: ETS_PIPELINE!,
    Input: {
      Key: input,
    },
    OutputKeyPrefix: "transcoded/",
    Outputs: [
      {
        Key: `dash-4m-${inputBasename}`,
        PresetId: "1351620000001-500020",
        SegmentDuration: "10"
      }, {
        Key: `dash-2m-${inputBasename}`,
        PresetId: "1351620000001-500030",
        SegmentDuration: "10"
      }, {
        Key: `dash-1m-${inputBasename}`,
        PresetId: "1351620000001-500040",
        SegmentDuration: "10"
      }, {
        Key: `dash-audio-${inputBasename}`,
        PresetId: "1351620000001-500060",
        SegmentDuration: "10"
      }
    ],
    Playlists: [
      {
        Format: "MPEG-DASH",
        Name: `${inputBasename}`,
        OutputKeys: [
          `dash-4m-${inputBasename}`,
          `dash-2m-${inputBasename}`,
          `dash-1m-${inputBasename}`,
          `dash-audio-${inputBasename}`,
        ],
      },
    ]
  };

  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.createJob(params, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.log(data);
        resolve();
      }
    });
  });
}

export function snsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-amz-sns-message-type"]) {
    req.headers["content-type"] = "application/json;charset=UTF-8";
  }

  next();
}

export function subscribeToSNSTopic(arn: string, endpoint: string): Promise<void> {
  const sns = new aws.SNS();

  return new Promise((resolve, reject) => {
    sns.subscribe({
      Protocol: "https",
      TopicArn: arn,
      Endpoint: endpoint
    }, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.log(data);
        resolve();
      }
    });
  });
}

export function unsubscribeFromSNSTopic(arn: string): Promise<void> {
  const sns = new aws.SNS();

  return new Promise((resolve, reject) => {
    sns.unsubscribe({
      SubscriptionArn: arn
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function confirmSubscription(headers: { "x-amz-sns-topic-arn": string, "x-amz-sns-message-type": string }, body: {Token: string}): Promise<string>{
  console.log("Confirming subscription:", headers, body);
  const sns = new aws.SNS();

  return new Promise(((resolve, reject) =>{
      sns.confirmSubscription({
        TopicArn: headers['x-amz-sns-topic-arn'],
        Token : body.Token
      }, (err, res) => {
          if (err) {
            console.log(err);
            return reject(err)
          }

          return resolve(res.SubscriptionArn);
      });
  }))

}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");

  if (parts.length == 1) {
    return "";
  }

  return "." + parts[parts.length - 1];
}

export async function insertVideoMetadata(db: Db, data: any) {
  const videos = db.collection("videos");

  const { jobId } = data;
  const entryExists = await videos.findOne({ jobId });

  if (entryExists) {
    console.log("Not inserting duplicate entry");
    return false;
  }

  const result = await videos.insertOne({
    name: data.input.key,
    jobId,
    resolutions: data.outputs.filter((o: any) => o.height).map((o: any) => o.height),
    duration: data.outputs[0].duration
  })

  return result.insertedCount === 1;
}
