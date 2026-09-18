import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlPrefix = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (publicUrlPrefix && url.startsWith(publicUrlPrefix)) {
      // Extract key from URL
      const key = url.replace(`${publicUrlPrefix}/`, "");

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await S3.send(command);
      
      return NextResponse.json({ success: true, key });
    } else {
       return NextResponse.json({ error: "Invalid URL or not hosted on R2" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
