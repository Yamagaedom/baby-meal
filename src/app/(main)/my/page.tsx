import { MyPageClient } from "@/components/MyPageClient";
import { listUserSocialAccounts, requirePageUser } from "@/features/auth";
import { listBabyProfiles } from "@/features/profile";

export default async function MyPage() {
  const user = await requirePageUser();
  const [babies, socialAccounts] = await Promise.all([
    listBabyProfiles(user.id),
    listUserSocialAccounts(user.id),
  ]);

  return (
    <MyPageClient
      loginId={user.loginId}
      email={user.email}
      initialSocialAccounts={socialAccounts}
      babies={babies}
    />
  );
}
