"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";
import { cropImageFile } from "@/components/new-company-form/helpers";
import type { ImageCropState } from "@/components/new-company-form/types";
import {
  MAX_CONTAINER_PHOTO_BYTES,
  MAX_CONTAINER_PHOTO_MB,
  MAX_CONTAINER_PHOTOS,
  createImageItems,
  type ImageItem,
  optimizeListingImageForUpload,
  removeImageItem,
  revokeImageItems,
} from "@/components/container-listing-form-shared";
import { formatTemplate } from "@/lib/i18n";

type UseContainerListingFormPhotosParams = {
  initialPhotoUrls?: string[];
  messages: ContainerModuleMessages;
  onWarning: (message: string) => void;
};

type AppendPhotosToFormDataOptions = {
  mode: "create" | "edit";
  canUploadPhotos: boolean;
};

export function useContainerListingFormPhotos({
  initialPhotoUrls,
  messages,
  onWarning,
}: UseContainerListingFormPhotosParams) {
  const stableInitialPhotoUrls = useMemo(
    () => initialPhotoUrls ?? [],
    [initialPhotoUrls],
  );
  const [coverPhotoItem, setCoverPhotoItem] = useState<ImageItem | null>(null);
  const [coverPhotoCrop, setCoverPhotoCrop] = useState<ImageCropState | null>(
    null,
  );
  const coverPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const coverPhotoCropSourceUrlRef = useRef<string | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [photoItems, setPhotoItems] = useState<ImageItem[]>([]);
  const [keptInitialPhotoIndexes, setKeptInitialPhotoIndexes] = useState<
    number[]
  >(() => stableInitialPhotoUrls.map((_, index) => index));
  const photoItemsRef = useRef<ImageItem[]>([]);
  const coverPhotoItemRef = useRef<ImageItem | null>(null);

  const visibleInitialPhotoCount = keptInitialPhotoIndexes.length;
  const totalPhotoCount =
    visibleInitialPhotoCount + photoItems.length + (coverPhotoItem ? 1 : 0);
  const mainPhotoPreviewUrl =
    coverPhotoItem?.previewUrl ??
    (keptInitialPhotoIndexes.length > 0
      ? (stableInitialPhotoUrls[keptInitialPhotoIndexes[0]] ?? null)
      : null);
  const additionalInitialPhotoIndexes = keptInitialPhotoIndexes.slice(1);

  useEffect(() => {
    setKeptInitialPhotoIndexes(stableInitialPhotoUrls.map((_, index) => index));
  }, [stableInitialPhotoUrls]);

  useEffect(() => {
    photoItemsRef.current = photoItems;
  }, [photoItems]);

  useEffect(() => {
    coverPhotoItemRef.current = coverPhotoItem;
  }, [coverPhotoItem]);

  useEffect(() => {
    coverPhotoCropSourceUrlRef.current = coverPhotoCrop?.sourceUrl ?? null;
  }, [coverPhotoCrop?.sourceUrl]);

  useEffect(() => {
    return () => {
      if (coverPhotoCropSourceUrlRef.current) {
        URL.revokeObjectURL(coverPhotoCropSourceUrlRef.current);
      }
      revokeImageItems(photoItemsRef.current);
      if (coverPhotoItemRef.current) {
        URL.revokeObjectURL(coverPhotoItemRef.current.previewUrl);
      }
    };
  }, []);

  const handleCoverPhotoFilesAdded = useCallback(
    (files: File[]) => {
      const firstImage = files.find((file) => file.type.startsWith("image/"));
      if (!firstImage) {
        onWarning(messages.form.addGraphicFile);
        return;
      }
      if (!coverPhotoItem && totalPhotoCount >= MAX_CONTAINER_PHOTOS) {
        onWarning(
          formatTemplate(messages.form.removePhotoForCover, {
            count: MAX_CONTAINER_PHOTOS,
          }),
        );
        return;
      }

      if (coverPhotoCrop?.sourceUrl) {
        URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
      }
      const sourceUrl = URL.createObjectURL(firstImage);
      setCoverPhotoCrop({
        sourceUrl,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    },
    [coverPhotoCrop, coverPhotoItem, messages.form.addGraphicFile, messages.form.removePhotoForCover, onWarning, totalPhotoCount],
  );

  const handleApplyCoverPhotoCrop = useCallback(async () => {
    if (!coverPhotoCrop) {
      return;
    }

    setIsProcessingImages(true);
    try {
      const croppedFile = await cropImageFile(
        coverPhotoCrop,
        "listing-cover-cropped.png",
        {
          outputWidth: 1200,
          outputHeight: 1200,
          fitMode: "cover",
        },
      );
      const optimized = await optimizeListingImageForUpload(
        croppedFile,
        MAX_CONTAINER_PHOTO_BYTES,
      );

      if (optimized.size > MAX_CONTAINER_PHOTO_BYTES) {
        onWarning(
          `Zdjecie glowne moze miec maksymalnie ${MAX_CONTAINER_PHOTO_MB} MB.`,
        );
        return;
      }

      const nextCover = createImageItems([optimized])[0];
      setCoverPhotoItem((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return nextCover;
      });

      URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
      setCoverPhotoCrop(null);
    } finally {
      setIsProcessingImages(false);
    }
  }, [coverPhotoCrop, onWarning]);

  const handleCancelCoverPhotoCrop = useCallback(() => {
    if (coverPhotoCrop?.sourceUrl) {
      URL.revokeObjectURL(coverPhotoCrop.sourceUrl);
    }
    setCoverPhotoCrop(null);
  }, [coverPhotoCrop]);

  const handleAdditionalPhotoFilesAdded = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length !== files.length) {
        onWarning(messages.form.imagesOnly);
      }
      if (imageFiles.length === 0) {
        return;
      }

      const remainingSlots = Math.max(
        0,
        MAX_CONTAINER_PHOTOS - totalPhotoCount,
      );
      if (remainingSlots === 0) {
        onWarning(
          formatTemplate(messages.form.maxPhotosTotal, {
            count: MAX_CONTAINER_PHOTOS,
          }),
        );
        return;
      }

      let candidateFiles = imageFiles;
      if (candidateFiles.length > remainingSlots) {
        candidateFiles = candidateFiles.slice(0, remainingSlots);
        onWarning(
          formatTemplate(messages.form.remainingPhotos, {
            count: remainingSlots,
          }),
        );
      }

      setIsProcessingImages(true);
      try {
        const optimizedFiles = await Promise.all(
          candidateFiles.map((file) =>
            optimizeListingImageForUpload(file, MAX_CONTAINER_PHOTO_BYTES),
          ),
        );

        const acceptedFiles = optimizedFiles.filter(
          (file) => file.size <= MAX_CONTAINER_PHOTO_BYTES,
        );
        if (acceptedFiles.length !== optimizedFiles.length) {
          onWarning(
            formatTemplate(messages.form.photoLimitPerFile, {
              count: MAX_CONTAINER_PHOTO_MB,
            }),
          );
        }

        if (acceptedFiles.length === 0) {
          return;
        }

        const accepted = createImageItems(acceptedFiles);
        setPhotoItems((prev) => [...prev, ...accepted]);
      } finally {
        setIsProcessingImages(false);
      }
    },
    [
      messages.form.imagesOnly,
      messages.form.maxPhotosTotal,
      messages.form.photoLimitPerFile,
      messages.form.remainingPhotos,
      onWarning,
      totalPhotoCount,
    ],
  );

  const removeMainPhoto = useCallback(() => {
    if (coverPhotoItem) {
      setCoverPhotoItem((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return null;
      });
      return;
    }

    setKeptInitialPhotoIndexes((previous) => previous.slice(1));
  }, [coverPhotoItem]);

  const removeInitialPhoto = useCallback((index: number) => {
    setKeptInitialPhotoIndexes((previous) =>
      previous.filter((value) => value !== index),
    );
  }, []);

  const removeUploadedPhoto = useCallback((id: string) => {
    setPhotoItems((previous) => removeImageItem(previous, id));
  }, []);

  const appendPhotosToFormData = useCallback(
    (formData: FormData, options: AppendPhotosToFormDataOptions) => {
      if (options.mode === "edit") {
        formData.set("keepPhotoIndexes", JSON.stringify(keptInitialPhotoIndexes));
        if (
          options.canUploadPhotos &&
          coverPhotoItem &&
          keptInitialPhotoIndexes.length > 0
        ) {
          formData.set("prependUploadedPhotos", "1");
        }
      }

      if (!options.canUploadPhotos) {
        return;
      }

      if (coverPhotoItem) {
        formData.append("photos", coverPhotoItem.file);
      }
      for (const item of photoItems) {
        formData.append("photos", item.file);
      }
    },
    [coverPhotoItem, keptInitialPhotoIndexes, photoItems],
  );

  const resetPhotosAfterSuccessfulSave = useCallback(() => {
    if (coverPhotoItem) {
      URL.revokeObjectURL(coverPhotoItem.previewUrl);
    }
    revokeImageItems(photoItems);
    setCoverPhotoItem(null);
    setPhotoItems([]);
  }, [coverPhotoItem, photoItems]);

  return {
    additionalInitialPhotoIndexes,
    appendPhotosToFormData,
    coverPhotoCrop,
    coverPhotoInputRef,
    coverPhotoItem,
    handleAdditionalPhotoFilesAdded,
    handleApplyCoverPhotoCrop,
    handleCancelCoverPhotoCrop,
    handleCoverPhotoFilesAdded,
    isProcessingImages,
    keptInitialPhotoIndexes,
    mainPhotoPreviewUrl,
    photoItems,
    removeInitialPhoto,
    removeMainPhoto,
    removeUploadedPhoto,
    resetPhotosAfterSuccessfulSave,
    setCoverPhotoCrop,
    stableInitialPhotoUrls,
    totalPhotoCount,
  };
}
