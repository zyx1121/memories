import { authOptions } from "@/lib/auth";
import { r2Client } from "@/lib/r2";
import { Photo, PhotoStore } from "@/types/photo";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import sharp from "sharp";

// 生成 blur placeholder 的尺寸
const BLUR_SIZE = 10;

async function generateBlurPlaceholder(buffer: Buffer): Promise<string> {
    const { data: data } = await sharp(buffer)
        .rotate()
        .resize(BLUR_SIZE, BLUR_SIZE, {
            fit: 'inside',
        })
        .blur(5)
        .webp({ quality: 20 })
        .toBuffer({ resolveWithObject: true });

    return `data:image/webp;base64,${data.toString('base64')}`;
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAllowedUploader) {
        return NextResponse.json({ error: "Unauthorized upload" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const metadataString = formData.get("metadata") as string;

        if (!file || !metadataString) {
            return NextResponse.json({ error: "File and metadata are required" }, { status: 400 });
        }

        const metadata = JSON.parse(metadataString);
        const buffer = await file.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);

        // 生成 blur placeholder
        const blurDataURL = await generateBlurPlaceholder(imageBuffer);

        // 處理主圖片
        const mainImage = await sharp(imageBuffer)
            .rotate()
            .webp({ quality: 80 })
            .toBuffer();

        const creationDate = metadata.creationDate ? new Date(metadata.creationDate) : new Date();
        const formattedDate = format(creationDate, "yyyyMMddHHmmss");
        const uniqueFileName = `${formattedDate}`;

        // 上傳主圖片
        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `images/${uniqueFileName}`,
            Body: mainImage,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000',
        }));

        // 更新 metadata
        let allMetadata: PhotoStore = {};
        try {
            const metadataCommand = new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: 'images/metadata.json',
            });
            const metadataResponse = await r2Client.send(metadataCommand);
            allMetadata = JSON.parse(await metadataResponse.Body!.transformToString());
        } catch {
            allMetadata = {};
        }

        const newPhotoMetadata: Photo = {
            filename: uniqueFileName,
            src: `https://r2.memories.zhanyongxiang.com/images/${uniqueFileName}`,
            blurDataURL,  // 儲存 blur placeholder
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
            CacheControl: 'no-cache, no-store, must-revalidate',
        }));

        return NextResponse.json({
            url: newPhotoMetadata.src,
            metadata: newPhotoMetadata
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
