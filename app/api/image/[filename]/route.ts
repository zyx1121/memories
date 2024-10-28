import { authOptions } from "@/lib/auth";
import { r2Client } from "@/lib/r2";
import { PhotoStore } from '@/types/photo';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const filename = decodeURIComponent((await params).filename);

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `images/${filename}`,
    });

    const response = await r2Client.send(command);
    const headers = new Headers();

    headers.set('Content-Type', response.ContentType || 'image/webp');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Check if response.Body exists before calling transformToWebStream
    if (!response.Body) {
      throw new Error("Image data not found");
    }

    return new NextResponse(response.Body.transformToWebStream(), { headers });
  } catch (error) {
    console.error('Error processing image request:', error);
    return NextResponse.json({ error: "Get image failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAllowedUploader) {
    return NextResponse.json({ error: "Unauthorized deletion" }, { status: 403 });
  }

  const filename = decodeURIComponent((await params).filename);

  try {
    // Delete image file
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `images/${filename}`,
    }));

    // Update metadata file
    let allMetadata: PhotoStore = {};
    try {
      const metadataCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: 'images/metadata.json',
      });
      const metadataResponse = await r2Client.send(metadataCommand);
      allMetadata = JSON.parse(await metadataResponse.Body!.transformToString());

      // Remove the deleted image's metadata
      delete allMetadata[filename];

      // Update metadata file
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: 'images/metadata.json',
        Body: JSON.stringify(allMetadata),
        ContentType: 'application/json',
      }));
    } catch (error) {
      console.error('Error updating metadata:', error);
    }

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
