import { auth } from '../firebase';
import { OperationType, DatabaseErrorInfo } from '../types';

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
