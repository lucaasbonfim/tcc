import { useCallback, useEffect, useState } from 'react';
import { research } from '../services/research.service';

export function useResearch(path, poll = false) {
  const [result,setResult] = useState({path:null,revision:-1,data:null,error:''});
  const [revision,setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value+1),[]);
  useEffect(() => {
    const controller = new AbortController();
    research.get(path,{signal:controller.signal}).then(value => {
      if (!controller.signal.aborted) setResult({path,revision,data:value,error:''});
    }).catch(cause => { if (!controller.signal.aborted) setResult(previous => ({path,revision,data:previous.path===path ? previous.data : null,error:cause.message})); });
    return () => controller.abort();
  },[path,revision]);
  const data = result.path===path ? result.data : null;
  const loading = result.path!==path || result.revision!==revision;
  const error = loading ? '' : result.error;
  useEffect(() => {
    if (!poll || !['pending','running'].includes(data?.status)) return;
    const timer = setInterval(reload,4000);
    return () => clearInterval(timer);
  },[poll,data?.status,reload]);
  return {data,error,loading,reload};
}
