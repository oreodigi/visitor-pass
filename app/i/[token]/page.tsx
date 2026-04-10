import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ShortInviteRedirectPage({ params }: PageProps) {
  const { token } = await params;
  redirect(`/invite/${token}`);
}
