import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export enum AuditAction {
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  PRODUCT_PRICE_UPDATE = 'PRODUCT_PRICE_UPDATE',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_STATUS_CHANGE = 'USER_STATUS_CHANGE',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  SALE_VOID = 'SALE_VOID'
}

export interface AuditLog {
  storeId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  details: string;
  metadata?: any;
  timestamp: any;
}

export const logAction = async (
  storeId: string,
  userId: string,
  userName: string,
  action: AuditAction,
  details: string,
  metadata?: any
) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      storeId,
      userId,
      userName,
      action,
      details,
      metadata: metadata || {},
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};
