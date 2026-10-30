export function trustedOrigin(request, _response, next) {
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.get('origin');
    const expected = process.env.FRONTEND_URL || 'http://localhost:5173';
    if ((origin && origin !== expected) || request.get('sec-fetch-site') === 'cross-site') {
      return next(Object.assign(new Error('Origem não autorizada.'),{statusCode:403}));
    }
  }
  next();
}
