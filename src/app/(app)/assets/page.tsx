import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AssetForm } from "@/components/asset-form";
import { deleteAsset } from "@/app/actions/asset-actions";
import { PageTitle, TranslatedText } from "@/components/translated";

export default async function AssetsPage() {
  const session = await requireAuth();

  const [assets, areas] = await Promise.all([
    db.asset.findMany({
      where: { userId: session.user.id },
      include: {
        area: true,
        _count: {
          select: {
            tasks: { where: { status: { notIn: ["DONE", "ARCHIVED"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle page="assets.title" />
      <TranslatedText path="assets.subtitle" className="text-sm text-muted-foreground" as="p" />

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <AssetForm areas={areas} />
      </div>

      {assets.length === 0 ? (
        <TranslatedText path="assets.empty" className="text-sm text-muted-foreground py-4 text-center" as="p" />
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm"
            >
              <div>
                  <p className="font-medium text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.area.name} · {asset._count.tasks} <TranslatedText path="assets.taskCount" />
                  </p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await deleteAsset(asset.id);
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-destructive hover:underline"
                >
                  <TranslatedText path="common.delete" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
