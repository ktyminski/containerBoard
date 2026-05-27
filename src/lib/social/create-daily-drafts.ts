import { ObjectId } from "mongodb";
import {
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  mapContainerListingToItem,
} from "@/lib/container-listings";
import { getAbsoluteUrl } from "@/lib/seo";
import {
  ensureSocialPostDraftIndexes,
  getSocialPostDraftsCollection,
  getWarsawDateKey,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social-post-drafts";
import { generateSocialImageForListing } from "@/lib/social/generate-image";
import { getListingPublicUrl, pickListingForSocialPost } from "@/lib/social/pick-listing";
import {
  generateFacebookCaption,
  generateInstagramCaption,
} from "@/lib/social/templates";

type CreateDailySocialDraftsResult = {
  success: true;
  skipped: boolean;
  dateKey: string;
  listingId: string | null;
  created: number;
  existing: number;
};

function buildTitle(input: {
  label: string;
  city?: string;
  country?: string;
}): string {
  const location = [input.city, input.country].filter(Boolean).join(", ");
  return location ? `${input.label} - ${location}` : input.label;
}

function generateCaption(input: {
  platform: SocialPlatform;
  item: ReturnType<typeof mapContainerListingToItem>;
  listingUrl: string;
  dateKey: string;
}): string {
  if (input.platform === "facebook") {
    return generateFacebookCaption(input);
  }
  return generateInstagramCaption(input);
}

export async function createDailySocialDrafts(
  now = new Date(),
): Promise<CreateDailySocialDraftsResult> {
  await ensureContainerListingsIndexes();
  await ensureSocialPostDraftIndexes();
  await expireContainerListingsIfNeeded(now);

  const dateKey = getWarsawDateKey(now);
  const drafts = await getSocialPostDraftsCollection();
  const existingDrafts = await drafts
    .find({ dateKey }, { projection: { platform: 1 } })
    .toArray();
  const existingPlatforms = new Set(existingDrafts.map((draft) => draft.platform));
  const missingPlatforms = SOCIAL_PLATFORMS.filter(
    (platform) => !existingPlatforms.has(platform),
  );

  if (missingPlatforms.length === 0) {
    return {
      success: true,
      skipped: true,
      dateKey,
      listingId: null,
      created: 0,
      existing: existingDrafts.length,
    };
  }

  const listing = await pickListingForSocialPost(now);
  if (!listing?._id) {
    return {
      success: true,
      skipped: true,
      dateKey,
      listingId: null,
      created: 0,
      existing: existingDrafts.length,
    };
  }

  const item = mapContainerListingToItem(listing);
  const relativeListingUrl = getListingPublicUrl(listing._id);
  const listingUrl = getAbsoluteUrl(relativeListingUrl);
  const image = await generateSocialImageForListing({ listing, dateKey });
  const title = buildTitle({
    label:
      item.container.size > 0
        ? `${item.container.size}'${item.container.height === "HC" ? "HC" : ""}`
        : "Kontener",
    city: item.locationCity,
    country: item.locationCountry,
  });

  let created = 0;
  for (const platform of missingPlatforms) {
    const result = await drafts.updateOne(
      {
        dateKey,
        platform,
      },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          listingId: listing._id,
          platform,
          status: "draft",
          title,
          caption: generateCaption({
            platform,
            item,
            listingUrl,
            dateKey,
          }),
          imageUrl: image.url,
          imagePathname: image.pathname,
          listingUrl,
          dateKey,
          generatedAt: now,
          updatedAt: now,
        },
      },
      {
        upsert: true,
      },
    );

    if (result.upsertedCount > 0) {
      created += 1;
    }
  }

  return {
    success: true,
    skipped: created === 0,
    dateKey,
    listingId: listing._id.toHexString(),
    created,
    existing: existingDrafts.length,
  };
}

