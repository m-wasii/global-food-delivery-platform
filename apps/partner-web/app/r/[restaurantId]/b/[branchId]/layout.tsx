import { PartnerShell } from '../../../../../components/partner-shell';

export default function BranchContextLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PartnerShell>{children}</PartnerShell>;
}
