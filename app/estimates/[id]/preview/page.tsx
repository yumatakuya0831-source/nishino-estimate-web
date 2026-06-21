import { EstimatePreview } from "@/components/estimates/estimate-preview";

export default async function EstimatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EstimatePreview estimateId={id} />;
}
