'use client'

import { Account } from '@/components/account';
import { ClusterThumbnail } from '@/components/cluster-thumbnail';
import { ImageUploader } from '@/components/image-uploader';
import Loading from '@/components/loading';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Photo, PhotoStore } from '@/types/photo';
import { Loader } from '@googlemaps/js-api-loader';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'lodash/debounce';
import { Trash } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

export default function Home() {
  const session = useSession();
  const mapRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadPhotos = useCallback(async () => {
    try {
      const response = await fetch(
        `https://r2.memories.zhanyongxiang.com/images/metadata.json?t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const metadata: PhotoStore = await response.json();
      setPhotos(Object.values(metadata));
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Move calculateClusterCenter outside of useEffect
  const calculateClusterCenter = useMemo(() => (cluster: Photo[]) => {
    const latitude = cluster.reduce((sum, photo) => sum + photo.latitude, 0) / cluster.length;
    const longitude = cluster.reduce((sum, photo) => sum + photo.longitude, 0) / cluster.length;
    return { lat: latitude, lng: longitude };
  }, []);

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        libraries: ['maps', 'marker', 'geometry']
      });

      const { Map } = await loader.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await loader.importLibrary('marker') as google.maps.MarkerLibrary;

      const map = new Map(mapRef.current as HTMLElement, {
        center: { lat: 25.003385192865906, lng: 121.52720552731212 },
        disableDefaultUI: true,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID as string,
        zoom: 12,
      });

      const markers: google.maps.marker.AdvancedMarkerElement[] = [];

      const debouncedUpdateMarkers = debounce(() => {
        markers.forEach(marker => marker.map = null);
        markers.length = 0;

        const zoom = map.getZoom() || 12;

        const gridSizes: { [key: number]: number } = {
          20: 0.0001,
          19: 0.0002,
          18: 0.0004,
          17: 0.0008,
          16: 0.0016,
          15: 0.0032,
          14: 0.0064,
          13: 0.0128,
          12: 0.0256,
          11: 0.0512,
          10: 0.1024,
          9: 0.2048,
          8: 0.4096,
          7: 0.8192,
          6: 1.6384,
          5: 3.2768,
          4: 6.5536,
          3: 13.1072,
          2: 26.2144,
          1: 52.4288,
          0: 104.8576,
        };

        const gridSize = gridSizes[Math.min(Math.max(zoom, 0), 20)];

        // Create grid-based clustering
        const grid: { [key: string]: Photo[] } = {};

        photos.forEach(photo => {
          const gridX = Math.floor(photo.longitude / gridSize);
          const gridY = Math.floor(photo.latitude / gridSize);
          const gridKey = `${gridX}|${gridY}`;

          if (!grid[gridKey]) {
            grid[gridKey] = [];
          }
          grid[gridKey].push(photo);
        });

        Object.values(grid).forEach(cluster => {
          const center = calculateClusterCenter(cluster);
          const markerElement = document.createElement('div');
          const root = createRoot(markerElement);

          const marker = new AdvancedMarkerElement({
            map,
            position: center,
            content: markerElement,
          });

          markers.push(marker);

          root.render(<ClusterThumbnail photos={cluster} />);

          marker.addListener('click', () => {
            if (cluster.length === 1) {
              setSelectedPhoto(cluster[0]);
            } else {
              const newZoom = Math.min((map.getZoom() || 12) + 2, 20);
              map.setZoom(newZoom);
              map.setCenter(center);
            }
          });
        });
      }, 150); // Increased debounce delay

      map.addListener('zoom_changed', debouncedUpdateMarkers);
      map.addListener('dragend', debouncedUpdateMarkers);

      debouncedUpdateMarkers();

      return () => {
        markers.forEach(marker => marker.map = null);
        debouncedUpdateMarkers.cancel();
      };
    };

    initMap();
  }, [photos, calculateClusterCenter]);

  const handleDelete = async (photo: Photo) => {
    if (!confirm('確定要刪除這張照片嗎？')) return;

    try {
      const response = await fetch(`/api/image/${photo.filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');

      setSelectedPhoto(null);

      const newMetadataResponse = await fetch(
        `https://r2.memories.zhanyongxiang.com/images/metadata.json?t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );
      const newMetadata: PhotoStore = await newMetadataResponse.json();
      setPhotos(Object.values(newMetadata));

      toast({
        title: "刪除成功",
        description: "照片已成功刪除。",
      });
    } catch (error) {
      console.error('刪除照片時發生錯誤:', error);
      toast({
        title: "刪除失敗",
        description: "刪除照片時發生錯誤，請稍後再試。",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <Loading />;

  return (
    <main className='w-dvw h-dvh relative'>
      <div className='fixed top-4 left-4 z-10 flex gap-2'>
        <Account />
        {session.data?.user?.isAllowedUploader && (
          <ImageUploader onUploadSuccess={loadPhotos} />
        )}
      </div>
      <div ref={mapRef} className="w-full h-full" />
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedPhoto(null)}
          >
            <>
              <Image
                className="rounded-lg object-contain w-auto h-auto max-w-[90dvw] max-h-[90dvh]"
                src={selectedPhoto.src}
                placeholder="blur"
                blurDataURL={selectedPhoto.blurDataURL}
                width={selectedPhoto.width}
                height={selectedPhoto.height}
                priority
                alt={`Photo at ${selectedPhoto.latitude}, ${selectedPhoto.longitude}`}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          </motion.div>
        )}
      </AnimatePresence>
      <div className='absolute top-4 right-4 z-10'>
        {selectedPhoto && session.data?.user?.isAllowedUploader && (
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/10 backdrop-blur-sm hover:bg-background/50 transition-colors rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(selectedPhoto);
            }}
          >
            <Trash className="w-4 h-4" />
          </Button>
        )}
      </div>
    </main >
  );
}
