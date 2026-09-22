import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to delete your SafaKing account and what happens to your data.',
};

export default function DeleteAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
