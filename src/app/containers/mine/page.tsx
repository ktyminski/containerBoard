import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MyContainerListings } from "@/components/my-container-listings";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";

export const metadata: Metadata = {
  title: "Moje kontenery | ContainerBoard",
  description: "Zarzadzaj swoimi ogloszeniami kontenerow.",
};

export default async function MyContainersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/login?next=/containers/mine");
  }

  const user = await getCurrentUserFromToken(token);
  if (!user?._id) {
    redirect("/login?next=/containers/mine");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <MyContainerListings />
    </main>
  );
}
