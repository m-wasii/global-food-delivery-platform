import { redirect } from 'next/navigation';
import { partnerPath } from '../../../../../lib/partner-nav';

export default async function BranchIndexPage({
  params,
}: {
  params: Promise<{ restaurantId: string; branchId: string }>;
}) {
  const { restaurantId, branchId } = await params;
  redirect(partnerPath(restaurantId, branchId, 'orders'));
}
