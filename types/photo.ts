export interface Photo {
  filename: string;
  src: string;
  width: number;
  height: number;
  latitude: number;
  longitude: number;
}

export interface PhotoStore {
  [key: string]: Photo;
}