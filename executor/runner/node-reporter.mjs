export default async function* reporter(source) {
  for await(const event of source) {
    const {type,data}=event;
    if(type==='test:pass' || type==='test:fail') {
      const error=data.details?.error;
      const cause=error?.cause || error;
      yield JSON.stringify({type,name:data.name,file:data.file,skip:data.skip || false,todo:data.todo || false,
        duration_ms:data.details?.duration_ms ?? null,error_code:cause?.code || null,error_name:cause?.name || null,
        message:cause?.message || error?.message || ''})+'\n';
    } else if(type==='test:stdout' || type==='test:stderr')yield JSON.stringify({type,message:data.message})+'\n';
  }
}
