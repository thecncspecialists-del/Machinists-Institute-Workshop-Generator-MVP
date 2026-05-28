import { ImportCatalogClient } from "@/components/ImportCatalogClient";

export default function ImportPage() {
  return <ImportCatalogClient defaultContributor={process.env.APP_DEFAULT_CONTRIBUTOR || "Curriculum Community"} />;
}
