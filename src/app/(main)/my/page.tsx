import { MyPageClient } from "@/components/MyPageClient";
import { requirePageUser } from "@/features/auth";
import { listBabyProfiles } from "@/features/profile";

export default async function MyPage() {
  const user = await requirePageUser();
  const babies = await listBabyProfiles(user.id);

  return <MyPageClient loginId={user.loginId} babies={babies} />;
}
