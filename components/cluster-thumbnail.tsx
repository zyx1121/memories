import { Photo } from '@/types/photo';
import Image from 'next/image';
import { memo } from 'react';

interface ClusterThumbnailProps {
  photos: Photo[];
  size?: number;
}

export const ClusterThumbnail = memo(function ClusterThumbnail({
  photos,
  size = 96
}: ClusterThumbnailProps) {
  const mainPhoto = photos[Math.floor(Math.random() * photos.length)];
  const count = photos.length;

  if (!mainPhoto) return null;

  return (
    <div className="relative">
      <Image
        className="rounded-lg object-cover shadow-lg"
        src={mainPhoto.src}
        width={size}
        height={size}
        alt={`Photo at ${mainPhoto.latitude}, ${mainPhoto.longitude}`}
        placeholder="blur"
        blurDataURL={mainPhoto.blurDataURL}
        priority
      />
      {count > 1 && (
        <div className="absolute -top-2 -right-2 backdrop-blur-md bg-black/10 text-secondary-foreground rounded-full w-8 h-8 flex items-center justify-center text-base shadow-lg">
          {count}
        </div>
      )}
    </div>
  );
});
