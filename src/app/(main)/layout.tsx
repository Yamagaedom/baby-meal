import { AppHeaderNav, BottomNav } from "@/components/AppHeaderNav";
import { PwaProviderAndOfflineBanner } from "@/components/PwaProviderAndOfflineBanner";
import { getActiveBabyIdCookie, requirePageUser } from "@/features/auth";
import { listBabyProfiles, resolveActiveBabyProfile } from "@/features/profile";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requirePageUser();
  const cookieBabyId = await getActiveBabyIdCookie();
  const [babies, activeBaby] = await Promise.all([
    listBabyProfiles(user.id),
    resolveActiveBabyProfile(user.id, { cookieBabyId }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-text)]">
      <PwaProviderAndOfflineBanner activeBabyId={activeBaby?.id ?? null} />
      <div className="flex flex-1 flex-col">
        <AppHeaderNav loginId={user.loginId} babies={babies} activeBaby={activeBaby} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1120px] min-w-0 flex-1 px-5 pt-7 pb-24 sm:px-8 lg:px-12 lg:py-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
