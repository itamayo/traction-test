import * as crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { Db } from "mongodb";
import * as aws from "aws-sdk";

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

export function uploadToS3(filename: string, file: aws.S3.Body, bucket = "troeggla-traction-test"): Promise<void> {
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
  const params = {
    PipelineId: "1584459675334-t9xv53",
    Input: {
      Key: input,
    },
    OutputKeyPrefix: "transcoded/",
    Outputs: [
      {
        Key: `dash-4m-${input}`,
        PresetId: "1351620000001-500020",
        SegmentDuration: "10"
      }, {
        Key: `dash-2m-${input}`,
        PresetId: "1351620000001-500030",
        SegmentDuration: "10"
      }, {
        Key: `dash-1m-${input}`,
        PresetId: "1351620000001-500040",
        SegmentDuration: "10"
      }, {
        Key: `dash-audio-${input}`,
        PresetId: "1351620000001-500060",
        SegmentDuration: "10"
      }
    ],
    Playlists: [
      {
        Format: "MPEG-DASH",
        Name: "index",
        OutputKeys: [
          `dash-4m-${input}`,
          `dash-2m-${input}`,
          `dash-1m-${input}`,
          `dash-audio-${input}`,
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
