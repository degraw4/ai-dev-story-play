import {charactersOrDefault,genderLabel} from './characters.js';
import {drawLeadershipPortrait} from './isometric-office.js';
import {loadCharacterArt} from './character-art.js';
export function createCharacterUI(){
  const assets={};let selection=charactersOrDefault();
  function render(next=selection){
    selection=charactersOrDefault(next);
    for(const canvas of document.querySelectorAll('[data-character-role],canvas.secretary-avatar')){
      const role=canvas.dataset.characterRole??'secretary',gender=canvas.dataset.characterGender??selection[role],choice={...selection,[role]:gender};
      drawLeadershipPortrait(canvas.getContext('2d'),assets,role,choice,canvas.width,canvas.height);
      canvas.setAttribute('aria-label',`${role==='boss'?'老板':'秘书小满'} · ${genderLabel(gender)}`);canvas.dataset.gender=gender;
    }
  }
  loadCharacterArt().then(()=>render()).catch(()=>{for(const canvas of document.querySelectorAll('[data-character-role],canvas.secretary-avatar'))canvas.setAttribute('aria-label','角色素材加载失败，请刷新页面');});
  const readForm=()=>({boss:document.querySelector('[name="boss-gender"]:checked').value,secretary:document.querySelector('[name="secretary-gender"]:checked').value});
  function syncForm(next){const choice=charactersOrDefault(next);for(const role of ['boss','secretary'])document.querySelector(`[name="${role}-gender"][value="${choice[role]}"]`).checked=true;}
  return {render,readForm,syncForm};
}
