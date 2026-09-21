import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("replace_")) throw new Error(`${name} is not configured`);
  return value;
}

function client() {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function bucket() {
  return required("R2_BUCKET_NAME");
}

export async function beginMultipart(key: string, contentType: string) {
  const response = await client().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }));
  if (!response.UploadId) throw new Error("R2 did not create the multipart upload");
  return response.UploadId;
}

export async function signPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(client(), new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 900 });
}

export async function finishMultipart(key: string, uploadId: string, parts: CompletedPart[]) {
  await client().send(new CompleteMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
}

export async function abortMultipart(key: string, uploadId: string) {
  await client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

export async function inspectObject(key: string) {
  return client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function signDownload(key: string, filename: string) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }), { expiresIn: 120 });
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  await client().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
}
