import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ restaurantId: string; branchId: string }>;
}

export default async function BranchHomePage({ params }: PageProps) {
  const { restaurantId, branchId } = await params;
  redirect(`/r/${restaurantId}/b/${branchId}/orders`);
}
