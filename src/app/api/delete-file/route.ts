import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { verifyUserRequest } from "@/lib/userAuthGuard";
import { adminDb } from "@/lib/firebaseAdmin";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlPrefix = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

const S3 = accountId && accessKeyId && secretAccessKey ? new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
}) : null;

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    if (!S3) {
      return NextResponse.json({ error: "R2 credentials missing in environment" }, { status: 500 });
    }

    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!publicUrlPrefix || !url.startsWith(publicUrlPrefix)) {
      return NextResponse.json({ error: "Invalid URL or not hosted on R2" }, { status: 400 });
    }

    // Extract key from URL
    const key = url.replace(`${publicUrlPrefix}/`, "");

    // Check ownership: Admin can delete any file
    const isAdmin = authCheck.user.email === "obunezicharis@gmail.com";
    const ownsPrefix = key.startsWith(`users/${authCheck.user.uid}/`);

    if (!isAdmin && !ownsPrefix) {
      // Check if this URL is the user's legacy profile picture
      const userDoc = await adminDb.collection("users").doc(authCheck.user.uid).get();
      const currentPhoto = userDoc.exists ? userDoc.data()?.photoURL : null;
      if (currentPhoto !== url) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to delete this file" },
          { status: 403 }
        );
      }
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await S3.send(command);
    
    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
