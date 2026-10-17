import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Temporary diagnostic: reports what origin the server derives. */
export const GET: RequestHandler = ({ request, url }) => {
  return json({
    derived: new URL(request.url).origin,
    sent: request.headers.get('origin'),
    urlOrigin: url.origin,
    host: request.headers.get('host'),
    proto: url.protocol
  });
};
