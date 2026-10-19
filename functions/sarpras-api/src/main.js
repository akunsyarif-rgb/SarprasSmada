// Entry point Appwrite Function "sarpras-api": satu function, router action.
// Request: POST JSON {action, ...input}. Response: {success, data, error:{message}}.
import { Client, TablesDB, Users, ID } from 'node-appwrite';
import { createStore } from './lib/store.js';
import { HttpError } from './lib/errors.js';
import { dispatch } from './router.js';

export default async ({ req, res, error }) => {
  try {
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
    const apiKey = req.headers['x-appwrite-key'];
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

    let body = req.bodyJson;
    if (!body || typeof body !== 'object') {
      try { body = JSON.parse(req.bodyText || '{}'); } catch { throw new HttpError(400, 'Body bukan JSON yang valid.'); }
    }

    const data = await dispatch(
      { store: createStore(new TablesDB(client)), users: new Users(client), now: new Date(), newId: () => ID.unique() },
      req.headers['x-appwrite-user-id'],
      body
    );
    return res.json({ success: true, data, error: null });
  } catch (e) {
    if (e instanceof HttpError) {
      return res.json({ success: false, data: null, error: { message: e.message } }, e.status);
    }
    error(String((e && e.stack) || e));
    return res.json({ success: false, data: null, error: { message: 'Terjadi kesalahan pada server.' } }, 500);
  }
};
