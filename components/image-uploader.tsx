'use client'

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isValid, parse } from "date-fns";
import EXIF from 'exif-js';
import { CalendarIcon, PlusCircle } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useRef, useState } from 'react';

interface Metadata {
  latitude: number | null;
  longitude: number | null;
  creationDate: Date | null;
  width: number | null;
  height: number | null;
}

interface EXIFData {
  GPSLatitude?: number[];
  GPSLatitudeRef?: string;
  GPSLongitude?: number[];
  GPSLongitudeRef?: string;
  DateTimeOriginal?: string;
  CreateDate?: string;
  ModifyDate?: string;
}

interface ImageUploaderProps {
  onUploadSuccess?: () => void;
}

export function ImageUploader({ onUploadSuccess }: ImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({
    latitude: null,
    longitude: null,
    creationDate: null,
    width: null,
    height: null,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setMetadata({
      latitude: null,
      longitude: null,
      creationDate: null,
      width: null,
      height: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDialogChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetState();
    }
  }, [resetState]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setIsDialogOpen(true);

      const img = new window.Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = objectUrl;

      EXIF.getData(file as unknown as string, function (this: { exifdata: EXIFData }) {
        const exifData = EXIF.getAllTags(this);
        const creationDate = getExifDate(exifData);

        setMetadata({
          latitude: exifData.GPSLatitude ? convertDMSToDD(exifData.GPSLatitude, exifData.GPSLatitudeRef || '') : null,
          longitude: exifData.GPSLongitude ? convertDMSToDD(exifData.GPSLongitude, exifData.GPSLongitudeRef || '') : null,
          creationDate: creationDate,
          width: img.width,
          height: img.height,
        });
      });
    }
  }, []);

  const handleMetadataChange = useCallback((name: string, value: number | Date | null | undefined) => {
    setMetadata(prev => ({ ...prev, [name]: value ?? null }));
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;

    setIsDialogOpen(false);

    toast({
      title: "上傳中",
      description: "正在處理您的圖片，請稍候...",
    });

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('metadata', JSON.stringify({
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      creationDate: metadata.creationDate?.toISOString(),
      width: metadata.width,
      height: metadata.height,
    }));

    try {
      const response = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      toast({
        title: "上傳成功",
        description: "您的圖片已成功上傳。",
      });

      onUploadSuccess?.();
    } catch {
      toast({
        title: "上傳失敗",
        description: "上傳過程中發生錯誤，請稍後再試。",
        variant: "destructive",
      });
    } finally {
      resetState();
    }
  }, [selectedFile, metadata, toast, resetState, onUploadSuccess]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="bg-black/10 backdrop-blur-sm hover:bg-background/50 transition-colors rounded-lg"
        onClick={() => fileInputRef.current?.click()}
      >
        <PlusCircle className="h-4 w-4" />
      </Button>
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              上傳照片
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              {preview && (
                <Image
                  src={preview}
                  alt="Preview"
                  width={imageSize.width}
                  height={imageSize.height}
                  className="w-full h-auto rounded-lg object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <form onSubmit={handleSubmit}>
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="latitude">
                      緯度
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      value={metadata.latitude || ''}
                      onChange={(e) => handleMetadataChange('latitude', parseFloat(e.target.value))}
                      placeholder="緯度"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="longitude">
                      經度
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      value={metadata.longitude || ''}
                      onChange={(e) => handleMetadataChange('longitude', parseFloat(e.target.value))}
                      placeholder="經度"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="creationDate">
                      日期
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !metadata.creationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {metadata.creationDate && isValid(metadata.creationDate)
                            ? format(metadata.creationDate, "PPP")
                            : <span>選擇日期</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={metadata.creationDate || undefined}
                          onSelect={(date) => handleMetadataChange('creationDate', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </form>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleSubmit}
            >
              上傳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function convertDMSToDD(dms: number[], ref: string) {
  const dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -dd : dd;
}

function getExifDate(exifData: EXIFData): Date | null {
  const dateFields = ['DateTimeOriginal', 'CreateDate', 'ModifyDate'];
  for (const field of dateFields) {
    if (exifData[field as keyof EXIFData]) {
      const dateStr = exifData[field as keyof EXIFData] as string;
      const parsedDate = parse(dateStr, "yyyy:MM:dd HH:mm:ss", new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    }
  }
  return null;
}
