import {useEffect,useRef} from 'react';
import {useBlocker} from 'react-router-dom';

export default function UnsavedChangesGuard({dirty}) {
  const blocker=useBlocker(({currentLocation,nextLocation})=>dirty&&(currentLocation.pathname!==nextLocation.pathname||currentLocation.search!==nextLocation.search)),back=useRef(null);
  useEffect(()=>{if(!dirty)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  useEffect(()=>{if(blocker.state!=='blocked')return;const previous=document.activeElement;back.current?.focus();return()=>previous?.isConnected&&previous.focus();},[blocker.state]);
  if(blocker.state!=='blocked')return null;
  function keys(e){if(e.key==='Escape')blocker.reset();if(e.key==='Tab'){const buttons=e.currentTarget.querySelectorAll('button'),target=e.shiftKey?buttons[0]:buttons[1];if(document.activeElement===target){e.preventDefault();(e.shiftKey?buttons[1]:buttons[0]).focus();}}}
  return <div className="unsaved-overlay"><section className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" onKeyDown={keys}><h2 id="unsaved-title">Há alterações não salvas</h2><p id="unsaved-description">Volte à edição para salvar ou descarte as alterações antes de sair.</p><div className="inline-actions"><button ref={back} className="research-button primary" onClick={()=>blocker.reset()}>Voltar à edição</button><button className="research-button secondary" onClick={()=>blocker.proceed()}>Sair sem salvar</button></div></section></div>;
}
