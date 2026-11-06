import { PartnerShell } from '../../../../../components/partner-shell';

export default function BranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PartnerShell>{children}</PartnerShell>;
}
