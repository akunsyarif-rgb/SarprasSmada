// Adapter tipis di atas node-appwrite TablesDB supaya handler mudah diuji dengan fake.
import { DATABASE_ID } from './config.js';

export function createStore(tablesDB) {
  const base = (tableId) => ({ databaseId: DATABASE_ID, tableId });
  return {
    async getRow(tableId, rowId) {
      try {
        return await tablesDB.getRow({ ...base(tableId), rowId });
      } catch (e) {
        if (e && e.code === 404) return null;
        throw e;
      }
    },
    createRow(tableId, rowId, data, permissions) {
      return tablesDB.createRow({ ...base(tableId), rowId, data, permissions });
    },
    updateRow(tableId, rowId, data) {
      return tablesDB.updateRow({ ...base(tableId), rowId, data });
    },
    incrementRowColumn(tableId, rowId, column, value) {
      return tablesDB.incrementRowColumn({ ...base(tableId), rowId, column, value });
    }
  };
}
