import { ObjectId, type Filter } from "mongodb";
import {
  getContainerListingsCollection,
  type ContainerListingDocument,
} from "@/lib/container-listings";

export async function assignCompanyListingsToOwner(input: {
  companyId: ObjectId;
  companySlug?: string;
  ownerUserId: ObjectId;
  now?: Date;
}): Promise<number> {
  const filters: Filter<ContainerListingDocument>[] = [
    { adminCreatedForCompanyId: input.companyId },
  ];
  const companySlug = input.companySlug?.trim();
  if (companySlug) {
    filters.push({ companySlug });
  }

  const listings = await getContainerListingsCollection();
  const result = await listings.updateMany(
    {
      $or: filters,
    },
    {
      $set: {
        createdByUserId: input.ownerUserId,
        updatedAt: input.now ?? new Date(),
      },
      $unset: {
        adminCreatedByUserId: "",
        adminCreatedForCompanyId: "",
      },
    },
  );

  return result.modifiedCount;
}
