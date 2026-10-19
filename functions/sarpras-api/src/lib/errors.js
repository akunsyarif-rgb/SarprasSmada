/** Error yang aman ditampilkan ke client; error lain dijawab generik 500. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m) => new HttpError(400, m);
export const forbidden = (m) => new HttpError(403, m || 'Anda tidak berhak melakukan aksi ini.');
export const notFound = (m) => new HttpError(404, m);
