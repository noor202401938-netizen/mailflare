import type { AppDatabase } from "@/db";

export async function isTeamMailboxSharingEnabled(_db?: AppDatabase): Promise<boolean> {
	return true;
}
