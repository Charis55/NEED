import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyUserRequest } from "@/lib/userAuthGuard";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

// Ensure S3 client is only created if env vars exist to prevent crash on build
const S3 = accountId && accessKeyId && secretAccessKey ? new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
}) : null;

// Whitelist of safe MIME types for uploads
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/pdf",
]);

// 15MB maximum file size limit
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    if (!S3) {
      return NextResponse.json({ error: "R2 credentials missing in environment" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 15MB size limit" },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only JPEG, PNG, WebP, HEIC, GIF, and PDF are allowed." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Prefix by user UID to enforce provenance and prevent IDOR file overwrites
    const sanitizedFileName = (file.name || "upload").replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `users/${authCheck.user.uid}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: file.type,
      Body: buffer,
    });

    await S3.send(command);

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ publicUrl, key });
  } catch (error) {
    console.error("Direct Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file directly" }, { status: 500 });
  }
}
