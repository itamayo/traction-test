# TRACTION Test

This repository contains a tentative solution for deploying what is to become
TRACTION on AWS. For this, it employs 4 AWS services: S3, ETS, SNS and
CloudFront. This repository itself contains a web frontend using React with a
backend server based upon Express running inside a Docker container. Another
container runs the MongoDB base image used as a database for storing uploaded
content and as session store.

In essence, the web application has a user log in, after which they can
proceed to upload video files using drag and drop. The videos are first
uploaded to the backend server. Once the transfer is started, the file is
streamed concurrently to S3 for storage. After the upload to S3 completes, the
backend attempts to start a transcoding job for the uploaded file on ETS
(Elastic Transcoding Service). In this configuration, it encodes one audio
file, video files in three different resolutions and generates a manifest file,
which can be used for streaming. This files are immediately stored in S3 again
under a predetermined prefix. Once the transcoding job is complete, a
notification is sent out on a SNS (Simple Notification Server) topic channel.
The web backend listens to these messages and upon reception inserts video
metadata into the local database, after which the video becomes accessible
through the frontend and can be played.

These notifications could also be used by other services. For instance, a
service could concurrently listen for encoding completion messages and fetch
the video files from S3 to generate subtitles, analyse the video or perform
computer vision tasks. The big advantage of this is that each service can
perform its job independently from each other and  only communicate through
the notification service, thereby completely decoupling components of the
application from each other.

The frontend employs `video.js` as a video player, which is fully customisable
and has plugins for DASH, HLS and VR/360 content.

This frontend, backend and database can be run locally, whereas the heavy
lifting is done in the cloud. One could, however, replace S3 and SNS through
services contained in the project `localstack` which aims to be a plug-and-play
replacement for AWS in local environments. One could go even further and
replace SNS through Pub/Sub channels in a Redis service. While `localstack`
does not contain a replacement for `ETS`, one could wrap this into a container
running `ffmpeg` to which transcoding jobs are submitted through a messaging
system.
