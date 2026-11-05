export const MAX_PROVIDER_WAIT_MS=60000;
// Extract only a duration; never persist error bodies, URLs, headers or credentials.
export function providerRetryAfterMs(error) {
  let body;
  try{const parsed=JSON.parse(error.message);body=parsed.error ?? parsed;}catch{return null;}
  const info=body?.details?.find(d=>d?.['@type']==='type.googleapis.com/google.rpc.RetryInfo');
  const duration=info?.retryDelay;
  if(typeof duration!=='string'||!/^\d+(?:\.\d{1,9})?s$/.test(duration))return null;
  const ms=Math.ceil(Number(duration.slice(0,-1))*1000);
  return Number.isSafeInteger(ms)&&ms>=0?ms:null;
}
