# Security Specification - POS & Management System

## Data Invariants
1. **Store Isolation**: Every document (except StoreSettings) MUST belong to a `storeId`. A user can only read/write documents that match their own `storeId`.
2. **Role Integrity**: Users cannot change their own roles or permissions unless they are a `Bootstrap Admin`.
3. **Module Access**: Read/Write access is granted only if the user has the explicit module permission OR is an `admin`/`manager`.
4. **Audit Integrity**: Audit logs and Sales are immutable (no updates allowed once created, except for technical stock adjustments in products).
5. **Terminal State**: Payroll and Leaves once 'approved'/'paid' or 'rejected' cannot be reverted to 'pending'.

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Cross-Store Read**: User A (Store 1) tries to fetch Product X (Store 2). -> **DENIED**
2. **Privilege Escalation**: User A tries to update their own role from 'cashier' to 'admin'. -> **DENIED**
3. **Ghost Sale**: User B tries to create a sale entry for Store 1 without being a member of Store 1. -> **DENIED**
4. **Inventory Poisoning**: User C tries to set a product price to -500. -> **DENIED**
5. **Shadow Field Injection**: User D tries to add a `isVerified: true` field to their profile which doesn't exist in schema. -> **DENIED**
6. **Sale Modification**: User E tries to lower the `totalAmount` of a sale after it was recorded. -> **DENIED**
7. **Identity Spoofing**: User F tries to create a sale using User G's `cashierId`. -> **DENIED**
8. **Resource Exhaustion**: User H tries to create a product with a name of 1MB string size. -> **DENIED** (Regex/Size checks)
9. **Orphaned Leave**: User I tries to create a leave request for a non-existent employee. -> **DENIED** (Exists check)
10. **State Shortcut**: User J tries to create a Payroll record already marked as 'paid'. -> **DENIED** (Initial state validation)
11. **Client Data Leak**: User K tries to list all clients from all stores without filtering by `storeId`. -> **DENIED** (Query enforcer)
12. **System Config Sabotage**: Non-admin tries to update `StoreSettings`. -> **DENIED**

## Implementation Logic
Rules will use `getUserData()` which fetches the profile from `/users/{uid}`. This profile contains the `storeId`.
Every collection match will check:
`resource.data.storeId == getUserData().storeId`
