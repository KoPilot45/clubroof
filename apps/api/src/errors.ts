/** Fachlicher Fehler mit HTTP-Status und einer Meldung, die Nutzern angezeigt werden kann. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () =>
  new HttpError(401, 'unauthorized', 'Bitte melde dich an, um fortzufahren.');

export const notFound = (what = 'Eintrag') =>
  new HttpError(404, 'not_found', `${what} wurde nicht gefunden.`);

export const forbidden = (message = 'Dafür fehlt dir die Berechtigung.') =>
  new HttpError(403, 'forbidden', message);
