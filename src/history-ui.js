import {total} from './game/rules.js';

const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};

// Shared by the game and the isolated review page. Economic and presentation
// history decorators are applied by career-ui / management-feedback-ui.
export function renderModelHistory(target,state,onReview){
  target.replaceChildren();
  const models=state.models.filter(model=>model.company==='player').reverse();
  if(!models.length)target.append(element('p','尚未发布。完成研发后需要正式召开发布会。','muted'));
  for(const model of models){
    const row=element('div',undefined,'history-row');row.dataset.modelId=model.id;row.tabIndex=-1;
    row.append(element('span',`第 ${model.day} 日 · ${model.name} · ${total(model)} 分`));
    const button=element('button','回看发布');button.type='button';button.addEventListener('click',()=>onReview(model));
    row.append(button);target.append(row);
  }
}
