import { useState } from "react";
import type { ImageCropState, ImageItem } from "@/components/new-company-form/types";

export function useCompanyMediaState() {
  const [logo, setLogo] = useState<ImageItem | null>(null);
  const [background, setBackground] = useState<ImageItem | null>(null);
  const [logoCrop, setLogoCrop] = useState<ImageCropState | null>(null);
  const [backgroundCrop, setBackgroundCrop] = useState<ImageCropState | null>(null);
  const [isInitialLogoRemoved, setIsInitialLogoRemoved] = useState(false);
  const [isInitialBackgroundRemoved, setIsInitialBackgroundRemoved] = useState(false);

  return {
    logo,
    setLogo,
    background,
    setBackground,
    logoCrop,
    setLogoCrop,
    backgroundCrop,
    setBackgroundCrop,
    isInitialLogoRemoved,
    setIsInitialLogoRemoved,
    isInitialBackgroundRemoved,
    setIsInitialBackgroundRemoved,
  };
}
