import { AuthView } from "@daveyplate/better-auth-ui";
import { Modal } from "../../modal";
import { AuthTabs } from "@/components/auth/auth-tabs";

export const dynamicParams = false;

export function generateStaticParams() {
  // Generate static params for common auth routes
  return [
    { path: ['sign-in'] },
    { path: ['sign-up'] },
    { path: ['forgot-password'] },
    { path: ['reset-password'] },
  ];
}

export default async function AuthModalPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params;
  const path = pathArray.join('/');

  // For sign-in and sign-up, show tabs. For other flows, show single view
  const showTabs = path === 'sign-in' || path === 'sign-up';

  return (
    <Modal>
      {showTabs ? (
        <AuthTabs defaultView={path === 'sign-up' ? 'sign-up' : 'sign-in'} />
      ) : (
        <AuthView path={path} />
      )}
    </Modal>
  );
}

