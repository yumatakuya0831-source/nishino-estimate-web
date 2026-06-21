import { EstimateEditor } from "@/components/estimates/estimate-editor";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EstimateEditor estimateId={id} />;
}
