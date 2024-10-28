import { authOptions } from "@/lib/auth";
import { r2Client } from "@/lib/r2";
import { Photo, PhotoStore } from "@/types/photo";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAllowedUploader) {
        return NextResponse.json({ error: "Unauthorized upload" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const metadataString = formData.get("metadata") as string;

    if (!file || !metadataString) {
        return NextResponse.json({ error: "File and metadata are required" }, { status: 400 });
    }

    const metadata = JSON.parse(metadataString);

    try {
        const buffer = await file.arrayBuffer();

        const creationDate = metadata.creationDate ? new Date(metadata.creationDate) : new Date();
        const formattedDate = format(creationDate, "yyyyMMddHHmmss");
        const uniqueFileName = `${formattedDate}`;

        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `images/${uniqueFileName}`,
            Body: Buffer.from(buffer),
            ContentType: 'image/webp',
        }));

        let allMetadata: PhotoStore = {};
        try {
            const metadataCommand = new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: 'images/metadata.json',
            });
            const metadataResponse = await r2Client.send(metadataCommand);
            allMetadata = JSON.parse(await metadataResponse.Body!.transformToString());
        } catch {
            // Metadata file doesn't exist yet, start with empty object
            allMetadata = {};
        }

        const newPhotoMetadata: Photo = {
            filename: uniqueFileName,
            src: `https://r2.memories.zhanyongxiang.com/images/${uniqueFileName}`,
            width: metadata.width,
            height: metadata.height,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
        };

        allMetadata[uniqueFileName] = newPhotoMetadata;

        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: 'images/metadata.json',
            Body: JSON.stringify(allMetadata),
            ContentType: 'application/json',
        }));

        return NextResponse.json({
            url: newPhotoMetadata.src,
            metadata: newPhotoMetadata
        });
    } catch {
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
