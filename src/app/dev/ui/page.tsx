import { notFound } from "next/navigation";
import { DevUiShowcaseClient } from "./DevUiShowcaseClient";

export default function DevUiPage() {
  // 프로덕션 런타임/빌드에서는 노출하지 않음
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevUiShowcaseClient />;
}
