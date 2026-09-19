import { redirect } from "next/navigation";
import { sessionProfile } from "@/lib/auth";
import { roleRoute } from "@/lib/types";

export default async function Home() {
  const profile = await sessionProfile();
  redirect(profile ? roleRoute[profile.role] : "/employee/login");
}
